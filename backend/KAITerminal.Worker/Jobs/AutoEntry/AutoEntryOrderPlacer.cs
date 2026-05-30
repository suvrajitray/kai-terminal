using KAITerminal.Broker;
using KAITerminal.Contracts.Domain;
using KAITerminal.Contracts.Options;
using KAITerminal.Infrastructure.Data;
using Microsoft.Extensions.Logging;

namespace KAITerminal.Worker.Jobs.AutoEntry;

internal sealed class AutoEntryOrderPlacer
{
    private readonly ILogger<AutoEntryOrderPlacer> _logger;

    public AutoEntryOrderPlacer(ILogger<AutoEntryOrderPlacer> logger)
    {
        _logger = logger;
    }

    public async Task<bool> PlaceAsync(
        IBrokerClient                broker,
        AutoEntryConfig              config,
        string                       optionType,
        string                       expiry,
        StrikeResolution             resolution,
        IReadOnlyList<ContractEntry> contracts,
        CancellationToken            ct)
    {
        var lotSize = contracts
            .FirstOrDefault(c => c.InstrumentType.Equals(optionType, StringComparison.OrdinalIgnoreCase)
                && c.Expiry == expiry)?.LotSize ?? 1;

        var qty   = config.Lots * (int)lotSize;
        var order = new BrokerOrderRequest(
            resolution.Token, qty, "SELL", "I", "MARKET",
            Exchange: resolution.Exchange);

        _logger.LogInformation(
            "[ENTRY] Placing SELL {OptionType} {Instrument}  |  expiry={Expiry}  |  token={Token}  |  qty={Qty} ({Lots}L × {LotSize})  |  mode={Mode}  [{User} / {Broker}]",
            optionType, config.Instrument, expiry, resolution.Token, qty, config.Lots, lotSize,
            config.StrikeMode, config.Username, config.BrokerType);

        try
        {
            await broker.PlaceOrderAsync(order, ct);
            _logger.LogInformation(
                "[ENTRY] Order placed — {OptionType} {Instrument}  qty={Qty}  [{User} / {Broker}]",
                optionType, config.Instrument, qty, config.Username, config.BrokerType);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "[ERROR] Order failed — {OptionType} {Instrument}  [{User} / {Broker}]",
                optionType, config.Instrument, config.Username, config.BrokerType);
            return false;
        }
    }
}
