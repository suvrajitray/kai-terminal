using System.Text.Json.Serialization;
using KAITerminal.Api.Endpoints;
using KAITerminal.Api.Extensions;
using KAITerminal.Infrastructure.Extensions;
using KAITerminal.Api.Hubs;
using KAITerminal.Api.Services;
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

var app = builder.Build();

await app.InitializeDatabaseAsync();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.UseWhen(ctx => ctx.Request.Path.StartsWithSegments("/api/upstox"),
    upstox => upstox.Use(async (ctx, next) =>
    {
        var token = ctx.Request.Headers["X-Upstox-Access-Token"].FirstOrDefault();
        Console.WriteLine("token: ", token);
        using (UpstoxTokenContext.Use(token))
            await next(ctx);
    }));

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

app.MapAuthEndpoints();
app.MapUpstoxEndpoints();
app.MapBrokerCredentialsEndpoints();
app.MapHub<PositionsHub>("/hubs/positions");

if (app.Environment.IsDevelopment())
    app.MapDiagnosticsEndpoints();

app.Run();
