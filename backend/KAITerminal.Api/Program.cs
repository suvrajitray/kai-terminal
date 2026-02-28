using KAITerminal.Api.Endpoints;
using KAITerminal.Api.Extensions;

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

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseHttpsRedirection();

app.MapAuthEndpoints();
app.MapZerodhaEndpoints();
app.MapBrokerCredentialsEndpoints();

if (app.Environment.IsDevelopment())
    app.MapDiagnosticsEndpoints();

app.Run();
