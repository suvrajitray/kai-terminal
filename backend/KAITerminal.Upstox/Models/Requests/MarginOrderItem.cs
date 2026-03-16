namespace KAITerminal.Upstox.Models.Requests;

public sealed record MarginOrderItem(string InstrumentToken, int Quantity, string Product, string TransactionType);
