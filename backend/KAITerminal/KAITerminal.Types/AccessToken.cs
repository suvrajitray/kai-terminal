namespace KAITerminal.Types;

public readonly record struct AccessToken
{
    private readonly string _value;

    public string Value => _value;

    public AccessToken(string value) => _value = value;

    public override string ToString() => Masked;

    public string Masked =>
        _value.Length <= 6
            ? "***"
            : $"{_value[..3]}***{_value[^3..]}";
}
