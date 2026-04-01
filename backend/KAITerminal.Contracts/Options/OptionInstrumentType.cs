namespace KAITerminal.Contracts.Options;

/// <summary>Helpers for option instrument type strings ("CE" / "PE").</summary>
public static class OptionInstrumentType
{
    public const string CE = "CE";
    public const string PE = "PE";

    public static bool IsCe(string instrumentType) =>
        instrumentType.Equals(CE, StringComparison.OrdinalIgnoreCase);
}
