using System.Security.Claims;
using System.Text;
using KAITerminal.Api.Models.Requests;
using KAITerminal.Api.Services;
using KAITerminal.Broker.Interfaces;
using KAITerminal.Broker.Zerodha;
using KAITerminal.Types;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// ---------------- CORS ----------------
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins(builder.Configuration["Frontend:Url"]!)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddScoped<JwtService>();

// 🔐 AUTH
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.UseSecurityTokenValidators = true;
    /*
    // uncomment for debugging JWT issues
    options.Events = new JwtBearerEvents
    {
        OnAuthenticationFailed = ctx =>
        {
            Console.WriteLine($"JWT FAILED: {ctx.Exception.Message}");
            return Task.CompletedTask;
        },
        OnTokenValidated = ctx =>
        {
            Console.WriteLine("JWT VALIDATED SUCCESSFULLY");
            return Task.CompletedTask;
        }
    };
    */
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidAudiences = new[] { builder.Configuration["Jwt:Audience"] },
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"]!)
        )
    };
})

// ✅ TEMPORARY external login storage (REQUIRED)
.AddCookie("External")

// ✅ Google uses ONLY the external cookie
.AddGoogle(options =>
{
    options.ClientId = builder.Configuration["GoogleAuth:ClientId"]!;
    options.ClientSecret = builder.Configuration["GoogleAuth:ClientSecret"]!;
    options.SignInScheme = "External"; // 🔑 THIS FIXES THE ERROR
});

builder.Services.AddAuthorization();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Kite connect settings start

builder.Services.Configure<ZerodhaSettings>(
    builder.Configuration.GetSection("Zerodha"));

builder.Services.AddHttpClient<KiteConnectHttpClient>();

builder.Services.AddTransient<IPositionProvider, ZerodhaPositionProvider>();
builder.Services.AddTransient<IOrderExecutor, ZerodhaOrderExecutor>();
builder.Services.AddTransient<ITokenGenerator, ZerodhaTokenGenerator>();
// Kite connect settings end

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// ---------------- ROUTES ----------------

// Google Login
app.MapGet("/auth/google", async (HttpContext context) =>
{
    await context.ChallengeAsync(GoogleDefaults.AuthenticationScheme,
         new AuthenticationProperties
         {
             RedirectUri = "/auth/google/callback"
         });
});

// Google Callback
app.MapGet("/auth/google/callback",
    async (HttpContext ctx, JwtService jwtService) =>
{
    var result = await ctx.AuthenticateAsync(GoogleDefaults.AuthenticationScheme);
    if (!result.Succeeded) return Results.Unauthorized();

    var user = result.Principal!;

    var token = jwtService.GenerateToken(
        user.FindFirstValue(ClaimTypes.NameIdentifier)!,
        user.FindFirstValue(ClaimTypes.Name)!,
        user.FindFirstValue(ClaimTypes.Email)!
    );

    return Results.Redirect(
        $"{builder.Configuration["Frontend:Url"]}/auth/callback?token={token}"
    );
});


app.MapGet("/api/profile", (ClaimsPrincipal user) =>
{
    return Results.Ok(new
    {
        name = string.IsNullOrWhiteSpace(user.FindFirstValue(ClaimTypes.Name)) ? user.FindFirst("name")?.Value : user.FindFirstValue(ClaimTypes.Name),
        email = user.FindFirstValue(ClaimTypes.Email) ?? user.FindFirst("email")?.Value
    });
})
.RequireAuthorization();

app.MapGet("/debug/claims", (ClaimsPrincipal user) =>
{
    return user.Claims.Select(c => new { c.Type, c.Value });
})
.RequireAuthorization();

// Logout


// Zerodha routes
app.MapGet("/api/zerodha/positions", async ([FromHeader(Name = "X-Zerodha-AccessToken")] string accessToken, IPositionProvider positionProvider) =>
{
    var positions = await positionProvider.GetOpenPositionsAsync(new AccessToken(accessToken));
    return Results.Ok(positions);
});


app.MapGet("/api/zerodha/mtm", async ([FromHeader(Name = "X-Zerodha-AccessToken")] string accessToken, IPositionProvider positionProvider) =>
{
    var mtm = await positionProvider.GetCurrentMtmAsync(new AccessToken(accessToken));
    return Results.Ok(new { Mtm = mtm });
});

app.MapPost("/api/zerodha/access-token", async (
    [FromBody] ZerodhaTokenRequest request,
    ITokenGenerator tokenGenerator) =>
{
    var token = await tokenGenerator.GenerateAccessTokenAsync(
        request.ApiKey,
        request.ApiSecret,
        request.RequestToken);
    return Results.Ok(new { AccessToken = token.Value });
});
app.Run();
