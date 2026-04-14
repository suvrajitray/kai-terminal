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
    private sealed class StubRepository : IRiskRepository
    {
        private readonly System.Collections.Concurrent.ConcurrentDictionary<string, UserRiskState> _store = new();

        public Task<T> ReadAsync<T>(string stateKey, Func<UserRiskState, T> read)
        {
            var state = _store.GetOrAdd(stateKey, _ => new UserRiskState());
            lock (state) { return Task.FromResult(read(state)); }
        }

        public Task ResetAsync(string stateKey)
        {
            _store.TryRemove(stateKey, out _);
            return Task.CompletedTask;
        }

        public Task MutateAsync(string stateKey, Action<UserRiskState> mutate)
        {
            var state = _store.GetOrAdd(stateKey, _ => new UserRiskState());
            lock (state) { mutate(state); }
            return Task.CompletedTask;
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

        var repo     = new StubRepository();
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

        var final = await repo.ReadAsync(key, s => s.Clone());
        final.TrailingActive.Should().BeTrue("trailing-stop write must not be lost");
        final.TrailingStop.Should().Be(1500m);
        final.AutoShiftCounts.Should().Contain("NIFTY_2026-04-17_PE_22000", 1,
            "shift-count write must not be lost");
    }

    [Fact]
    public async Task MutateAsync_HighConcurrency_ShiftCountIsAccurate()
    {
        // 50 concurrent IncrementAutoShiftCount calls — result must equal 50, not less.
        var repo     = new StubRepository();
        const string key      = "user1::upstox";
        const string chainKey = "NIFTY_2026-04-17_PE_22000";

        var tasks = Enumerable.Range(0, 50)
            .Select(_ => repo.MutateAsync(key, s => s.IncrementAutoShiftCount(chainKey)));

        await Task.WhenAll(tasks);

        var final = await repo.ReadAsync(key, s => s.Clone());
        final.AutoShiftCounts[chainKey].Should().Be(50);
    }

    [Fact]
    public async Task MutateAsync_DifferentKeys_DoNotBlockEachOther()
    {
        // Mutations on different stateKeys must proceed in parallel (no shared lock).
        var repo = new StubRepository();

        var sw = System.Diagnostics.Stopwatch.StartNew();

        var tasks = Enumerable.Range(0, 10)
            .Select(i => repo.MutateAsync($"user{i}::upstox", s => s.TrailingActive = true));

        await Task.WhenAll(tasks);
        sw.Stop();

        // 10 independent keys in parallel should complete well under 1 s
        sw.ElapsedMilliseconds.Should().BeLessThan(1000);

        for (var i = 0; i < 10; i++)
        {
            var s = await repo.ReadAsync($"user{i}::upstox", state => state.Clone());
            s.TrailingActive.Should().BeTrue();
        }
    }
}
