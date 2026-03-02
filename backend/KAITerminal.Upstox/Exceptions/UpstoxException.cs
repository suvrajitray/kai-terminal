using KAITerminal.Upstox.Models;

namespace KAITerminal.Upstox.Exceptions;

public sealed class UpstoxException : Exception
{
    public int? HttpStatusCode { get; }
    public string? ErrorCode { get; }
    public IReadOnlyList<UpstoxApiError>? ApiErrors { get; }

    public UpstoxException(
        string message,
        int? httpStatusCode = null,
        string? errorCode = null,
        IReadOnlyList<UpstoxApiError>? apiErrors = null)
        : base(message)
    {
        HttpStatusCode = httpStatusCode;
        ErrorCode = errorCode;
        ApiErrors = apiErrors;
    }
}
