public interface IRiskEngine
{
  Task EvaluateAsync(CancellationToken ct);
}
