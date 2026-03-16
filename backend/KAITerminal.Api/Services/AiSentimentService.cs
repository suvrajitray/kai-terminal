using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using KAITerminal.Api.Models;
using KAITerminal.Upstox.Models.Enums;
using KAITerminal.Upstox.Services;

namespace KAITerminal.Api.Services;

public sealed class AiSentimentService : IAiSentimentService
{
    private const string NiftyKey      = "NSE_INDEX|Nifty 50";
    private const string BankNiftyKey  = "NSE_INDEX|Nifty Bank";
    private const string SensexKey     = "BSE_INDEX|SENSEX";

    private readonly IOptionService      _options;
    private readonly IMarketQuoteService _quotes;
    private readonly IChartDataService   _charts;
    private readonly IHttpClientFactory  _httpFactory;
    private readonly IConfiguration      _config;
    private readonly ILogger<AiSentimentService> _logger;

    public AiSentimentService(
        IOptionService options,
        IMarketQuoteService quotes,
        IChartDataService charts,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<AiSentimentService> logger)
    {
        _options     = options;
        _quotes      = quotes;
        _charts      = charts;
        _httpFactory = httpFactory;
        _config      = config;
        _logger      = logger;
    }

    public async Task<AiSentimentResponse> GetSentimentAsync(CancellationToken ct = default)
    {
        var cfg = _config.GetSection("AiSentiment");

        // ── 1. Resolve nearest expiry for NIFTY and BANKNIFTY ──────────────────
        var today = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5));

        var (niftyContractsTask, bankNiftyContractsTask) = (
            _options.GetOptionContractsAsync(NiftyKey, null, ct),
            _options.GetOptionContractsAsync(BankNiftyKey, null, ct));

        await Task.WhenAll(niftyContractsTask, bankNiftyContractsTask);

        var niftyExpiry     = ResolveNearestExpiry(niftyContractsTask.Result, today);
        var bankNiftyExpiry = ResolveNearestExpiry(bankNiftyContractsTask.Result, today);

        // ── 2. Fetch data in parallel ───────────────────────────────────────────
        var chainNiftyTask     = niftyExpiry     is not null ? _options.GetOptionChainAsync(NiftyKey, niftyExpiry, ct)         : Task.FromResult<IReadOnlyList<Upstox.Models.Responses.OptionChainEntry>>([]);
        var chainBankNiftyTask = bankNiftyExpiry is not null ? _options.GetOptionChainAsync(BankNiftyKey, bankNiftyExpiry, ct) : Task.FromResult<IReadOnlyList<Upstox.Models.Responses.OptionChainEntry>>([]);
        var quotesTask         = _quotes.GetMarketQuotesAsync([NiftyKey, BankNiftyKey, SensexKey], ct);
        var candlesTask        = _charts.GetIntradayCandlesAsync(NiftyKey, CandleInterval.OneMinute, ct);

        await Task.WhenAll(chainNiftyTask, chainBankNiftyTask, quotesTask, candlesTask);

        var chainNifty     = chainNiftyTask.Result;
        var chainBankNifty = chainBankNiftyTask.Result;
        var marketQuotes   = quotesTask.Result;
        var allCandles     = candlesTask.Result;

        // Last 30 candles (30 minutes of 1-min data)
        var candles = allCandles.Count <= 30 ? allCandles : allCandles.Skip(allCandles.Count - 30).ToList();

        // ── 3. Extract key metrics ──────────────────────────────────────────────
        marketQuotes.TryGetValue(NiftyKey.Replace('|', ':'),     out var niftyQuote);
        marketQuotes.TryGetValue(BankNiftyKey.Replace('|', ':'), out var bankNiftyQuote);
        marketQuotes.TryGetValue(SensexKey.Replace('|', ':'),    out var sensexQuote);

        // Fallback: try original key format
        if (niftyQuote is null)     marketQuotes.TryGetValue(NiftyKey,     out niftyQuote);
        if (bankNiftyQuote is null) marketQuotes.TryGetValue(BankNiftyKey, out bankNiftyQuote);
        if (sensexQuote is null)    marketQuotes.TryGetValue(SensexKey,    out sensexQuote);

        var niftyLtp     = niftyQuote?.LastPrice     ?? 0m;
        var bankNiftyLtp = bankNiftyQuote?.LastPrice ?? 0m;
        var sensexLtp    = sensexQuote?.LastPrice    ?? 0m;

        var niftyOptionsData     = BuildOptionsData(chainNifty,     "NIFTY");
        var bankNiftyOptionsData = BuildOptionsData(chainBankNifty, "BANKNIFTY");
        var niftyPcr             = niftyOptionsData.Pcr;

        // ── 4. Build prompt ─────────────────────────────────────────────────────
        var systemPrompt = "You are an expert Indian equity derivatives analyst. Analyse the provided market snapshot and return a JSON object only. No explanation, no markdown, no code blocks — just raw JSON.";

        var userPrompt = BuildPrompt(
            niftyQuote, bankNiftyQuote, sensexQuote,
            niftyLtp, bankNiftyLtp, sensexLtp,
            niftyOptionsData, bankNiftyOptionsData,
            candles);

        // ── 5. Call all 4 AI APIs in parallel ──────────────────────────────────
        var results = await Task.WhenAll(
            CallOpenAiAsync("GPT-4o",  "openai",     cfg["OpenAiApiKey"],  cfg["OpenAiModel"]  ?? "gpt-4o-mini",             systemPrompt, userPrompt, ct),
            CallOpenAiAsync("Grok",    "xai",        cfg["GrokApiKey"],    cfg["GrokModel"]    ?? "grok-3-mini",              systemPrompt, userPrompt, ct),
            CallGeminiAsync("Gemini",  "google",     cfg["GeminiApiKey"],  cfg["GeminiModel"]  ?? "gemini-2.0-flash",         systemPrompt, userPrompt, ct),
            CallClaudeAsync("Claude",  "anthropic",  cfg["ClaudeApiKey"],  cfg["ClaudeModel"]  ?? "claude-haiku-4-5-20251001", systemPrompt, userPrompt, ct)
        );

        return new AiSentimentResponse(
            GeneratedAt:  DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(5.5)),
            NiftyLtp:     niftyLtp,
            BankNiftyLtp: bankNiftyLtp,
            NiftyPcr:     niftyPcr,
            Models:       [..results]);
    }

    // ── Nearest expiry resolution ────────────────────────────────────────────────

    private static string? ResolveNearestExpiry(
        IReadOnlyList<Upstox.Models.Responses.OptionContract> contracts,
        DateTimeOffset today)
    {
        return contracts
            .Where(c => DateOnly.TryParse(c.Expiry, out var d) && d >= DateOnly.FromDateTime(today.DateTime))
            .OrderBy(c => c.Expiry)
            .Select(c => c.Expiry)
            .FirstOrDefault();
    }

    // ── Options data extraction ──────────────────────────────────────────────────

    private record OptionsData(
        string Underlying,
        decimal SpotPrice,
        decimal AtmStrike,
        decimal CeIv,
        decimal PeIv,
        decimal Pcr,
        IEnumerable<(decimal Strike, decimal Oi)> TopCe,
        IEnumerable<(decimal Strike, decimal Oi)> TopPe);

    private static OptionsData BuildOptionsData(
        IReadOnlyList<Upstox.Models.Responses.OptionChainEntry> chain,
        string underlying)
    {
        if (chain.Count == 0)
            return new OptionsData(underlying, 0, 0, 0, 0, 0, [], []);

        var spot = chain[0].UnderlyingSpotPrice;
        var atm  = chain.MinBy(e => Math.Abs(e.StrikePrice - spot));

        var ceIv = atm?.CallOptions?.OptionGreeks?.Iv ?? 0m;
        var peIv = atm?.PutOptions?.OptionGreeks?.Iv  ?? 0m;

        var totalCeOi = chain.Sum(e => e.CallOptions?.MarketData?.Oi ?? 0m);
        var totalPeOi = chain.Sum(e => e.PutOptions?.MarketData?.Oi  ?? 0m);
        var pcr       = totalCeOi > 0 ? Math.Round(totalPeOi / totalCeOi, 2) : 0m;

        var topCe = chain
            .Where(e => e.CallOptions?.MarketData?.Oi > 0)
            .OrderByDescending(e => e.CallOptions!.MarketData!.Oi)
            .Take(5)
            .Select(e => (e.StrikePrice, e.CallOptions!.MarketData!.Oi));

        var topPe = chain
            .Where(e => e.PutOptions?.MarketData?.Oi > 0)
            .OrderByDescending(e => e.PutOptions!.MarketData!.Oi)
            .Take(5)
            .Select(e => (e.StrikePrice, e.PutOptions!.MarketData!.Oi));

        return new OptionsData(underlying, spot, atm?.StrikePrice ?? spot, ceIv, peIv, pcr, topCe, topPe);
    }

    // ── Prompt builder ───────────────────────────────────────────────────────────

    private static string BuildPrompt(
        Upstox.Models.Responses.MarketQuote? nifty,
        Upstox.Models.Responses.MarketQuote? bankNifty,
        Upstox.Models.Responses.MarketQuote? sensex,
        decimal niftyLtp, decimal bankNiftyLtp, decimal sensexLtp,
        OptionsData niftyOpts, OptionsData bankNiftyOpts,
        IEnumerable<Upstox.Models.Responses.CandleData> candles)
    {
        var sb = new StringBuilder();

        // Index OHLC table
        sb.AppendLine("=== INDEX SNAPSHOT ===");
        sb.AppendLine("Index     | LTP       | Open      | High      | Low       | Net Chg   | % Chg");
        sb.AppendLine("----------|-----------|-----------|-----------|-----------|-----------|-------");
        AppendIndexRow(sb, "NIFTY",     niftyLtp,     nifty);
        AppendIndexRow(sb, "BANKNIFTY", bankNiftyLtp, bankNifty);
        AppendIndexRow(sb, "SENSEX",    sensexLtp,    sensex);
        sb.AppendLine();

        // Options data
        AppendOptionsBlock(sb, niftyOpts);
        AppendOptionsBlock(sb, bankNiftyOpts);

        // 1-min candles
        sb.AppendLine("=== NIFTY 1-MIN CANDLES (RECENT 30) ===");
        sb.AppendLine("Time  | Open    | High    | Low     | Close   | Volume");
        sb.AppendLine("------|---------|---------|---------|---------|--------");
        foreach (var c in candles)
        {
            sb.AppendLine(
                $"{c.Timestamp:HH:mm} | {c.Open,7:F0} | {c.High,7:F0} | {c.Low,7:F0} | {c.Close,7:F0} | {c.Volume,8}");
        }
        sb.AppendLine();

        // Expected output
        sb.AppendLine("=== REQUIRED JSON OUTPUT ===");
        sb.AppendLine("""
{
  "direction": "Strong Bullish | Bullish | Sideways | Bearish | Strong Bearish",
  "confidence": "High | Medium | Low",
  "reasons": ["reason 1", "reason 2", "reason 3"],
  "support": 22450,
  "resistance": 22700,
  "watch_for": "one sentence about what to watch"
}
""");

        return sb.ToString();
    }

    private static void AppendIndexRow(
        StringBuilder sb, string name,
        decimal ltp, Upstox.Models.Responses.MarketQuote? q)
    {
        if (q is null) { sb.AppendLine($"{name,-9} | {ltp,9:F2} | N/A"); return; }
        var pct = ltp > 0 ? q.NetChange / (ltp - q.NetChange) * 100m : 0m;
        sb.AppendLine(
            $"{name,-9} | {ltp,9:F2} | {q.Ohlc?.Open,9:F2} | {q.Ohlc?.High,9:F2} | {q.Ohlc?.Low,9:F2} | {q.NetChange,+9:F2} | {pct,+6:F2}%");
    }

    private static void AppendOptionsBlock(StringBuilder sb, OptionsData o)
    {
        sb.AppendLine($"=== {o.Underlying} OPTIONS (Spot: {o.SpotPrice:F2}, ATM: {o.AtmStrike:F0}) ===");
        sb.AppendLine($"CE IV: {o.CeIv:F2}%  |  PE IV: {o.PeIv:F2}%  |  PCR (OI): {o.Pcr:F2}");
        sb.AppendLine($"Top 5 CE strikes by OI: {string.Join(", ", o.TopCe.Select(x => $"{x.Strike:F0}({x.Oi:F0})"))}");
        sb.AppendLine($"Top 5 PE strikes by OI: {string.Join(", ", o.TopPe.Select(x => $"{x.Strike:F0}({x.Oi:F0})"))}");
        sb.AppendLine();
    }

    // ── AI callers ───────────────────────────────────────────────────────────────

    private async Task<AiModelResult> CallOpenAiAsync(
        string model, string provider,
        string? apiKey, string modelId,
        string system, string user,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(apiKey))
            return ErrorResult(model, provider, "API key not configured.");

        var sw = Stopwatch.StartNew();
        try
        {
            var clientName = provider == "xai" ? "Grok" : "OpenAi";
            var client = _httpFactory.CreateClient(clientName);

            var body = new
            {
                model = modelId,
                messages = new[]
                {
                    new { role = "system", content = system },
                    new { role = "user",   content = user   },
                },
                temperature = 0.3,
                response_format = new { type = "json_object" },
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            var response = await client.PostAsJsonAsync("/v1/chat/completions", body, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(cts.Token);
                sw.Stop();
                return ErrorResult(model, provider, $"HTTP {(int)response.StatusCode}: {Truncate(errBody)}", sw.ElapsedMilliseconds);
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc  = JsonNode.Parse(json);
            var text = doc?["choices"]?[0]?["message"]?["content"]?.GetValue<string>() ?? "";

            sw.Stop();
            return ParseAiJson(model, provider, text, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "AI call failed for {Model}", model);
            return ErrorResult(model, provider, ex.Message, sw.ElapsedMilliseconds);
        }
    }

    private async Task<AiModelResult> CallGeminiAsync(
        string model, string provider,
        string? apiKey, string modelId,
        string system, string user,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(apiKey))
            return ErrorResult(model, provider, "API key not configured.");

        var sw = Stopwatch.StartNew();
        try
        {
            var client = _httpFactory.CreateClient("Gemini");
            // Use absolute URI — relative URIs with colons in the path can mis-resolve with some HttpClient configurations
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{modelId}:generateContent?key={apiKey}";

            var body = new
            {
                system_instruction = new { parts = new[] { new { text = system } } },
                contents           = new[] { new { parts = new[] { new { text = user } } } },
                generationConfig   = new { responseMimeType = "application/json" },
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            var response = await client.PostAsJsonAsync(url, body, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(cts.Token);
                sw.Stop();
                return ErrorResult(model, provider, $"HTTP {(int)response.StatusCode}: {Truncate(errBody)}", sw.ElapsedMilliseconds);
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc  = JsonNode.Parse(json);
            var text = doc?["candidates"]?[0]?["content"]?["parts"]?[0]?["text"]?.GetValue<string>() ?? "";

            sw.Stop();
            return ParseAiJson(model, provider, text, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "AI call failed for {Model}", model);
            return ErrorResult(model, provider, ex.Message, sw.ElapsedMilliseconds);
        }
    }

    private async Task<AiModelResult> CallClaudeAsync(
        string model, string provider,
        string? apiKey, string modelId,
        string system, string user,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(apiKey))
            return ErrorResult(model, provider, "API key not configured.");

        var sw = Stopwatch.StartNew();
        try
        {
            var client = _httpFactory.CreateClient("Claude");

            var body = new
            {
                model      = modelId,
                max_tokens = 1024,
                system,
                messages   = new[] { new { role = "user", content = user } },
            };

            var request = new HttpRequestMessage(HttpMethod.Post, "/v1/messages")
            {
                Content = new StringContent(
                    JsonSerializer.Serialize(body),
                    Encoding.UTF8, "application/json"),
            };
            request.Headers.Add("x-api-key",         apiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            var response = await client.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var errBody = await response.Content.ReadAsStringAsync(cts.Token);
                sw.Stop();
                return ErrorResult(model, provider, $"HTTP {(int)response.StatusCode}: {Truncate(errBody)}", sw.ElapsedMilliseconds);
            }

            var json = await response.Content.ReadAsStringAsync(cts.Token);
            var doc  = JsonNode.Parse(json);
            var text = doc?["content"]?[0]?["text"]?.GetValue<string>() ?? "";

            sw.Stop();
            return ParseAiJson(model, provider, text, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "AI call failed for {Model}", model);
            return ErrorResult(model, provider, ex.Message, sw.ElapsedMilliseconds);
        }
    }

    private static string Truncate(string s) => s.Length <= 400 ? s : s[..400] + "…";

    // ── JSON parser ──────────────────────────────────────────────────────────────

    private static AiModelResult ParseAiJson(
        string model, string provider, string text, long latencyMs)
    {
        try
        {
            // Strip markdown code fences if present
            var clean = text.Trim();
            if (clean.StartsWith("```"))
            {
                var start = clean.IndexOf('{');
                var end   = clean.LastIndexOf('}');
                if (start >= 0 && end > start)
                    clean = clean[start..(end + 1)];
            }

            using var doc = JsonDocument.Parse(clean);
            var root = doc.RootElement;

            var reasons = new List<string>();
            if (root.TryGetProperty("reasons", out var reasonsEl) &&
                reasonsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in reasonsEl.EnumerateArray())
                    reasons.Add(r.GetString() ?? "");
            }

            decimal? ParseDecimal(string key)
            {
                if (root.TryGetProperty(key, out var el) &&
                    el.ValueKind == JsonValueKind.Number)
                    return el.GetDecimal();
                return null;
            }

            return new AiModelResult(
                Model:      model,
                Provider:   provider,
                Direction:  root.TryGetProperty("direction",  out var d) ? d.GetString() : null,
                Confidence: root.TryGetProperty("confidence", out var c) ? c.GetString() : null,
                Reasons:    reasons,
                Support:    ParseDecimal("support"),
                Resistance: ParseDecimal("resistance"),
                WatchFor:   root.TryGetProperty("watch_for", out var w) ? w.GetString() : null,
                Error:      null,
                LatencyMs:  latencyMs);
        }
        catch
        {
            return ErrorResult(model, provider, $"Failed to parse response: {text[..Math.Min(200, text.Length)]}", latencyMs);
        }
    }

    private static AiModelResult ErrorResult(
        string model, string provider, string error, long latencyMs = 0)
        => new(model, provider, null, null, [], null, null, null, error, latencyMs);
}
