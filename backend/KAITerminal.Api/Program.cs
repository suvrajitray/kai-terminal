using System.Text.Json.Serialization;
using KAITerminal.Api.Endpoints;
using KAITerminal.Api.Extensions;
using KAITerminal.Api.Hubs;
using KAITerminal.Api.Services;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.Auth.Endpoints;
using KAITerminal.Auth.Extensions;
using KAITerminal.Upstox;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

builder.Services
    .AddAuthServices(builder.Configuration)
    .AddAuthorization()
    .AddOpenApi()
    .AddDatabase(builder.Configuration)
    .AddBrokerServices(builder.Configuration)
    .AddSignalR();

builder.Services.AddSingleton<PositionStreamManager>();
builder.Services.AddSingleton<IndexStreamManager>();
builder.Services.AddScoped<UserTradingSettingsService>();

if (!string.IsNullOrEmpty(builder.Configuration["ApplicationInsights:ConnectionString"]))
    builder.Services.AddApplicationInsightsTelemetry(builder.Configuration);

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

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

app.MapAuthEndpoints();
app.MapUpstoxEndpoints();
app.MapChartEndpoints();
app.MapBrokerCredentialsEndpoints();
app.MapUserSettingsEndpoints();
app.MapAiSentimentEndpoints();
app.MapRiskConfigEndpoints();
app.MapHub<PositionsHub>("/hubs/positions");
app.MapHub<IndexHub>("/hubs/indices");

if (app.Environment.IsDevelopment())
    app.MapDiagnosticsEndpoints();

app.Run();
