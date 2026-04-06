using System.Text.Json.Serialization;
using KAITerminal.Api.Endpoints;
using StackExchange.Redis;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Hubs;
using KAITerminal.Api.Notifications;
using KAITerminal.Api.Services;
using KAITerminal.Contracts.Notifications;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.Auth.Endpoints;
using KAITerminal.Auth.Extensions;
using KAITerminal.Upstox;
using KAITerminal.Zerodha;
using Scalar.AspNetCore;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((ctx, services, cfg) => cfg
    .ReadFrom.Configuration(ctx.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName());

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services
    .AddAuthServices(builder.Configuration)
    .AddAuthorization()
    .AddOpenApi(options =>
    {
        options.AddDocumentTransformer((doc, _, _) =>
        {
            doc.Info.Title       = "KAI Terminal API";
            doc.Info.Version     = "v1";
            doc.Info.Description = "Broker-agnostic trading terminal API — positions, orders, funds, options, and risk config.";
            return Task.CompletedTask;
        });
    })
    .AddMemoryCache()
    .AddDatabase(builder.Configuration)
    .AddBrokerServices(builder.Configuration);

var signalR = builder.Services.AddSignalR();
var redisConnStr = builder.Configuration.GetConnectionString("Redis");
if (!string.IsNullOrWhiteSpace(redisConnStr))
    signalR.AddStackExchangeRedis(redisConnStr, o => o.Configuration.ChannelPrefix = RedisChannel.Literal("signalr"));

builder.Services.AddSingleton<IRiskEventNotifier, SignalRRiskEventNotifier>();
builder.Services.AddSingleton<PositionStreamManager>();
builder.Services.AddSingleton<IndexStreamManager>();
builder.Services.AddSingleton<OptionChainStreamManager>();
builder.Services.AddScoped<UserTradingSettingsService>();
builder.Services.AddSingleton<MasterDataService>();

var app = builder.Build();

await app.InitializeDatabaseAsync();

app.UseExceptionHandler(errApp => errApp.Run(async ctx =>
{
    var logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>()
        .CreateLogger("KAITerminal.Api.GlobalExceptionHandler");
    var feature = ctx.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();

    if (feature?.Error is KAITerminal.Upstox.Exceptions.UpstoxException ex)
    {
        logger.LogWarning(ex,
            "Upstox API error on {Method} {Path}: {Message}",
            ctx.Request.Method, ctx.Request.Path, ex.Message);
        ctx.Response.StatusCode = ex.HttpStatusCode ?? 422;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { message = ex.Message });
    }
    else if (feature?.Error is HttpRequestException httpEx)
    {
        logger.LogWarning(httpEx,
            "Broker API error on {Method} {Path}: {Message}",
            ctx.Request.Method, ctx.Request.Path, httpEx.Message);
        ctx.Response.StatusCode = 422;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { message = httpEx.Message });
    }
    else if (feature?.Error is not null)
    {
        logger.LogError(feature.Error,
            "Unhandled exception on {Method} {Path}",
            ctx.Request.Method, ctx.Request.Path);
        ctx.Response.StatusCode = 500;
        ctx.Response.ContentType = "application/json";
        await ctx.Response.WriteAsJsonAsync(new { message = "An unexpected error occurred." });
    }
}));

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api/upstox"),
    upstox => upstox.Use(async (ctx, next) =>
    {
        var token = ctx.Request.Headers["X-Upstox-Access-Token"].FirstOrDefault();
        using (UpstoxTokenContext.Use(token))
            await next(ctx);
    }));

app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api/zerodha"),
    zerodha => zerodha.Use(async (ctx, next) =>
    {
        var apiKey = ctx.Request.Headers["X-Zerodha-Api-Key"].FirstOrDefault();
        var token  = ctx.Request.Headers["X-Zerodha-Access-Token"].FirstOrDefault();
        using (ZerodhaTokenContext.Use(apiKey ?? "", token ?? ""))
            await next(ctx);
    }));

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.Title           = "KAI Terminal API";
        options.Theme           = ScalarTheme.DeepSpace;
        options.DefaultHttpClient = new(ScalarTarget.JavaScript, ScalarClient.Fetch);
    });
}

app.UseHttpsRedirection();

app.MapAuthEndpoints();
app.MapUpstoxEndpoints();
app.MapZerodhaEndpoints();
app.MapBrokerCredentialsEndpoints();
app.MapUserSettingsEndpoints();
app.MapRiskConfigEndpoints();
app.MapRiskLogEndpoints();
app.MapMasterDataEndpoints();
app.MapRiskNotificationEndpoints();
app.MapAdminEndpoints();
app.MapHub<PositionsHub>("/hubs/positions");
app.MapHub<IndexHub>("/hubs/indices");
app.MapHub<RiskHub>("/hubs/risk");
app.MapHub<OptionChainHub>("/hubs/option-chain");

if (app.Environment.IsDevelopment())
    app.MapDiagnosticsEndpoints();

app.Run();

}
catch (Exception ex)
{
    Log.Fatal(ex, "API host terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
