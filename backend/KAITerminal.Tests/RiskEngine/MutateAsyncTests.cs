using FluentAssertions;
using KAITerminal.RiskEngine.Abstractions;
using KAITerminal.RiskEngine.Models;
using Xunit;

namespace KAITerminal.Tests.RiskEngine;

/// <summary>
/// Verifies the MutateAsync serialisation contract using an in-memory repository stub.
/// Specifically guards against the read/modify/write race between the session-loop trailing-stop
/// writer and the fire-and-forget shift-count writer that run concurrently on the same key.
/// </summary>
public class MutateAsyncTests
{
    // ── in-memory stub ────────────────────────────────────────────────────────

    /// <summary>
    /// Minimal in-memory IRiskRepository that implements the same MutateAsync
    /// locking logic as RedisRiskRepository (one SemaphoreSlim per key).
    /// Used to verify the contract without a real Redis connection.
    /// </summary>
    private sealed class InMemoryRiskRepository : IRiskRepository
    {
        private readonly Dictionary<string, UserRiskState> _store = new();
        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> _locks = new();

        public Task<UserRiskState> GetOrCreateAsync(string stateKey)
        {
            lock (_store)
            {
                if (!_store.TryGetValue(stateKey, out var s))
                    _store[stateKey] = s = new UserRiskState();
                return Task.FromResult(s);
            }
        }

        public Task UpdateAsync(string stateKey, UserRiskState state)
        {
            lock (_store) { _store[stateKey] = state; }
            return Task.CompletedTask;
        }

        public Task ResetAsync(string stateKey)
        {
            lock (_store) { _store.Remove(stateKey); }
            return Task.CompletedTask;
        }

        public async Task MutateAsync(string stateKey, Action<UserRiskState> mutate)
        {
            var sem = _locks.GetOrAdd(stateKey, _ => new SemaphoreSlim(1, 1));
            await sem.WaitAsync();
            try
            {
                var state = await GetOrCreateAsync(stateKey);
                mutate(state);
                await UpdateAsync(stateKey, state);
            }
            finally
            {
                sem.Release();
            }
        }
    }

    // ── tests ─────────────────────────────────────────────────────────────────

    [Fact]
    public async Task MutateAsync_ConcurrentWritesToDifferentFields_BothChangesArePreserved()
    {
        // This is the exact race the fix targets:
        //   Task A (trailing stop): reads state → sets TrailingActive/Stop → writes
        //   Task B (shift count):   reads state → increments AutoShiftCounts → writes
        // Without MutateAsync, last-writer-wins. With it, each sees the other's change.

        var repo     = new InMemoryRiskRepository();
        const string key = "user1::upstox";

        var taskA = repo.MutateAsync(key, s =>
        {
            s.TrailingActive = true;
            s.TrailingStop   = 1500m;
        });

        var taskB = repo.MutateAsync(key, s =>
        {
            s.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000");
        });

        await Task.WhenAll(taskA, taskB);

        var final = await repo.GetOrCreateAsync(key);
        final.TrailingActive.Should().BeTrue("trailing-stop write must not be lost");
        final.TrailingStop.Should().Be(1500m);
        final.AutoShiftCounts.Should().Contain("NIFTY_2026-04-17_PE_22000", 1,
            "shift-count write must not be lost");
    }

    [Fact]
    public async Task MutateAsync_HighConcurrency_ShiftCountIsAccurate()
    {
        // 50 concurrent IncrementAutoShiftCount calls — result must equal 50, not less.
        var repo     = new InMemoryRiskRepository();
        const string key      = "user1::upstox";
        const string chainKey = "NIFTY_2026-04-17_PE_22000";

        var tasks = Enumerable.Range(0, 50)
            .Select(_ => repo.MutateAsync(key, s => s.IncrementAutoShiftCount(chainKey)));

        await Task.WhenAll(tasks);

        var final = await repo.GetOrCreateAsync(key);
        final.AutoShiftCounts[chainKey].Should().Be(50);
    }

    [Fact]
    public async Task MutateAsync_DifferentKeys_DoNotBlockEachOther()
    {
        // Mutations on different stateKeys must proceed in parallel (no shared lock).
        var repo = new InMemoryRiskRepository();

        var sw = System.Diagnostics.Stopwatch.StartNew();

        var tasks = Enumerable.Range(0, 10)
            .Select(i => repo.MutateAsync($"user{i}::upstox", s => s.TrailingActive = true));

        await Task.WhenAll(tasks);
        sw.Stop();

        // 10 independent keys in parallel should complete well under 1 s
        sw.ElapsedMilliseconds.Should().BeLessThan(1000);

        for (var i = 0; i < 10; i++)
        {
            var s = await repo.GetOrCreateAsync($"user{i}::upstox");
            s.TrailingActive.Should().BeTrue();
        }
    }
}
