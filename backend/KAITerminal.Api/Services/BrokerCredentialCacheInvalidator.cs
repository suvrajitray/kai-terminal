using Microsoft.Extensions.Primitives;

namespace KAITerminal.Api.Services;

/// <summary>
/// Singleton that owns the cancellation token used to evict all cached
/// <see cref="BrokerCredentialService"/> entries in one shot whenever any
/// credential is written. Injected into the scoped service so that a single
/// cancel propagates across all concurrent request scopes.
/// </summary>
public sealed class BrokerCredentialCacheInvalidator
{
    private CancellationTokenSource _cts = new();

    /// <summary>Returns a change token linked to the current eviction source.</summary>
    public IChangeToken GetChangeToken() => new CancellationChangeToken(_cts.Token);

    /// <summary>
    /// Invalidates all cache entries that were created with <see cref="GetChangeToken"/>.
    /// Safe to call from any thread.
    /// </summary>
    public void Invalidate()
    {
        var old = Interlocked.Exchange(ref _cts, new CancellationTokenSource());
        old.Cancel();
        old.Dispose();
    }
}
