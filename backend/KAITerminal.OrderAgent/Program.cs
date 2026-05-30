using System.Net;
using System.Net.Sockets;
using KAITerminal.OrderAgent.Endpoints;
using KAITerminal.Upstox.Extensions;
using KAITerminal.Zerodha.Extensions;

var builder = WebApplication.CreateBuilder(args);

var bindIp = IPAddress.Parse(builder.Configuration["BindIp"]
    ?? throw new InvalidOperationException("BindIp is required"));

builder.Services.AddUpstoxSdk(builder.Configuration);
builder.Services.AddZerodhaSdk(builder.Configuration);

foreach (var name in new[] { "UpstoxApi", "UpstoxHft", "UpstoxAuth", "ZerodhaApi", "ZerodhaAuth" })
{
    var captured = bindIp;
    builder.Services.AddHttpClient(name)
        .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
        {
            ConnectCallback = async (ctx, ct) =>
            {
                var socket = new Socket(AddressFamily.InterNetwork, SocketType.Stream, ProtocolType.Tcp);
                socket.Bind(new IPEndPoint(captured, 0));
                await socket.ConnectAsync(ctx.DnsEndPoint, ct);
                return new NetworkStream(socket, ownsSocket: true);
            }
        });
}

var app = builder.Build();

UpstoxAgentEndpoints.Map(app);
ZerodhaAgentEndpoints.Map(app);

app.Run();
