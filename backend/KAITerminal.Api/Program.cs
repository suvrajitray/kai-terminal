using KAITerminal.Api.Endpoints;
using KAITerminal.Api.Extensions;
using KAITerminal.Upstox;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddAuthServices(builder.Configuration)
    .AddAuthorization()
    .AddOpenApi()
    .AddDatabase(builder.Configuration)
    .AddBrokerServices(builder.Configuration);

var app = builder.Build();

await app.InitializeDatabaseAsync();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.UseWhen(
    ctx => ctx.Request.Path.StartsWithSegments("/api/upstox"),
    upstox => upstox.Use(async (ctx, next) =>
    {
        var token = ctx.Request.Headers["X-Upstox-AccessToken"].FirstOrDefault();
        using (UpstoxTokenContext.Use(token))
            await next(ctx);
    }));

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

app.MapAuthEndpoints();
app.MapUpstoxEndpoints();
app.MapBrokerCredentialsEndpoints();

if (app.Environment.IsDevelopment())
    app.MapDiagnosticsEndpoints();

app.Run();
