namespace KAITerminal.Api.Models;

public record struct UpstoxTokenRequest(
    string ApiKey,
    string ApiSecret,
    string RedirectUri,
    string Code);

public record struct UpdateAccessTokenRequest(string AccessToken);

public record struct SaveUserTradingSettingsRequest(
    int NiftyShiftOffset,
    int SensexShiftOffset,
    int BankniftyShiftOffset,
    int FinniftyShiftOffset = 5,
    int BankexShiftOffset = 10,
    string IndexChangeMode = "prevClose");

public record struct SaveBrokerCredentialRequest(
    string BrokerName,
    string ApiKey,
    string ApiSecret,
    string AccessToken = "");

public record struct ConvertPositionRequest(string OldProduct, int Quantity);

public record MarginRequest(List<MarginInstrumentRequest> Instruments);
public record MarginInstrumentRequest(string InstrumentToken, int Quantity, string Product, string TransactionType);

public record ShiftPositionRequest(
    string  InstrumentToken,  // current position token (broker-specific format)
    string  Exchange,         // exchange of the current position e.g. "NFO", "BFO", "NSE_FO"
    int     Qty,              // absolute quantity to shift
    string  Direction,        // "up" | "down"
    string  Product,          // e.g. "Intraday", "Delivery", "NRML"
    decimal CurrentStrike,    // strike price of the current position
    int     StrikeGap,        // number of strikes to move
    string  UnderlyingKey,    // e.g. "NSE_INDEX|Nifty 50"
    string  Expiry,           // e.g. "2026-03-27"
    string  InstrumentType,   // "CE" | "PE"
    bool    IsShort           // true when position.quantity < 0
);

public record ByPriceOrderRequest(
    string  UnderlyingKey,    // e.g. "NSE_INDEX|Nifty 50"
    string  Expiry,           // e.g. "2026-03-27"
    string  InstrumentType,   // "CE" | "PE"
    decimal TargetPremium,
    int     Qty,
    string  TransactionType,  // "Buy" | "Sell"
    string  Product           // e.g. "I", "D", "NRML", "MIS"
);
