# Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a focused xUnit + FluentAssertions test suite covering the four pure-logic backend classes where correctness has direct financial consequences.

**Architecture:** Single `KAITerminal.Tests` project under `backend/`, with test files mirroring source namespaces. All targets are pure static methods or simple state classes — no mocks required. `InternalsVisibleTo` exposes `PositionMapper` from `KAITerminal.Api`.

**Tech Stack:** xUnit 2.9.3, FluentAssertions 6.12.0, Microsoft.NET.Test.Sdk 17.12.0, .NET 10

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `backend/KAITerminal.Tests/KAITerminal.Tests.csproj` | Test project definition |
| Modify | `backend/KAITerminal.Api/KAITerminal.Api.csproj` | Add `InternalsVisibleTo` |
| Create | `backend/KAITerminal.Tests/Contracts/ProductTypeFilterTests.cs` | Filter logic tests |
| Create | `backend/KAITerminal.Tests/RiskEngine/TrailingStopCalculatorTests.cs` | Trailing floor math tests |
| Create | `backend/KAITerminal.Tests/RiskEngine/RiskDecisionCalculatorTests.cs` | Risk evaluation order tests |
| Create | `backend/KAITerminal.Tests/RiskEngine/UserRiskStateTests.cs` | State mutation tests |
| Create | `backend/KAITerminal.Tests/Api/PositionMapperTests.cs` | String-to-enum parsing tests |

---

## Task 1: Create the test project and wire `InternalsVisibleTo`

**Files:**
- Create: `backend/KAITerminal.Tests/KAITerminal.Tests.csproj`
- Modify: `backend/KAITerminal.Api/KAITerminal.Api.csproj`

- [ ] **Step 1: Create the test project file**

Create `backend/KAITerminal.Tests/KAITerminal.Tests.csproj`:

```xml
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>
    <PackageReference Include="FluentAssertions" Version="6.12.0" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="../KAITerminal.Contracts/KAITerminal.Contracts.csproj" />
    <ProjectReference Include="../KAITerminal.RiskEngine/KAITerminal.RiskEngine.csproj" />
    <ProjectReference Include="../KAITerminal.Api/KAITerminal.Api.csproj" />
  </ItemGroup>

</Project>
```

- [ ] **Step 2: Add `InternalsVisibleTo` to `KAITerminal.Api.csproj`**

Open `backend/KAITerminal.Api/KAITerminal.Api.csproj` and add a new `<ItemGroup>` block before the closing `</Project>` tag:

```xml
  <ItemGroup>
    <AssemblyAttribute Include="System.Runtime.CompilerServices.InternalsVisibleTo">
      <_Parameter1>KAITerminal.Tests</_Parameter1>
    </AssemblyAttribute>
  </ItemGroup>
```

- [ ] **Step 3: Verify the project builds**

```bash
dotnet build backend/KAITerminal.Tests
```

Expected: build succeeds with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add backend/KAITerminal.Tests/KAITerminal.Tests.csproj backend/KAITerminal.Api/KAITerminal.Api.csproj
git commit -m "test: scaffold KAITerminal.Tests project with xUnit and FluentAssertions"
```

---

## Task 2: `ProductTypeFilter` tests

**Files:**
- Create: `backend/KAITerminal.Tests/Contracts/ProductTypeFilterTests.cs`

- [ ] **Step 1: Create the test file**

Create `backend/KAITerminal.Tests/Contracts/ProductTypeFilterTests.cs`:

```csharp
using FluentAssertions;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Tests.Contracts;

public class ProductTypeFilterTests
{
    // ── "All" filter ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData("I")]
    [InlineData("D")]
    [InlineData("MIS")]
    [InlineData("NRML")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void All_PassesEveryProduct(string product)
    {
        ProductTypeFilter.Matches(product, "All").Should().BeTrue();
    }

    // ── "Intraday" filter ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    public void Intraday_PassesIntradayProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Intraday").Should().BeTrue();
    }

    [Theory]
    [InlineData("D")]
    [InlineData("NRML")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void Intraday_BlocksNonIntradayProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Intraday").Should().BeFalse();
    }

    [Fact]
    public void Intraday_IsCaseInsensitive()
    {
        ProductTypeFilter.Matches("mis", "Intraday").Should().BeTrue();
        ProductTypeFilter.Matches("i", "Intraday").Should().BeTrue();
    }

    // ── "Delivery" filter ─────────────────────────────────────────────────────

    [Theory]
    [InlineData("D")]
    [InlineData("NRML")]
    public void Delivery_PassesDeliveryProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Delivery").Should().BeTrue();
    }

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    [InlineData("CO")]
    [InlineData("CNC")]
    public void Delivery_BlocksNonDeliveryProducts(string product)
    {
        ProductTypeFilter.Matches(product, "Delivery").Should().BeFalse();
    }

    [Fact]
    public void Delivery_IsCaseInsensitive()
    {
        ProductTypeFilter.Matches("nrml", "Delivery").Should().BeTrue();
        ProductTypeFilter.Matches("d", "Delivery").Should().BeTrue();
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
dotnet test backend/KAITerminal.Tests --filter "FullyQualifiedName~ProductTypeFilterTests"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.Tests/Contracts/ProductTypeFilterTests.cs
git commit -m "test: add ProductTypeFilter tests"
```

---

## Task 3: `TrailingStopCalculator` tests

**Files:**
- Create: `backend/KAITerminal.Tests/RiskEngine/TrailingStopCalculatorTests.cs`

- [ ] **Step 1: Create the test file**

Create `backend/KAITerminal.Tests/RiskEngine/TrailingStopCalculatorTests.cs`:

```csharp
using FluentAssertions;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;

namespace KAITerminal.Tests.RiskEngine;

public class TrailingStopCalculatorTests
{
    // ── Disabled ──────────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenTrailingDisabled()
    {
        var config = new UserConfig { TrailingEnabled = false };
        TrailingStopCalculator.Evaluate(50_000m, config, new UserRiskState())
            .Should().BeNull();
    }

    // ── Not yet active ────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenNotActiveAndBelowThreshold()
    {
        var config = new UserConfig { TrailingEnabled = true, TrailingActivateAt = 10_000m };
        TrailingStopCalculator.Evaluate(9_999m, config, new UserRiskState())
            .Should().BeNull();
    }

    [Fact]
    public void ReturnsActivation_WhenMtmExactlyAtThreshold()
    {
        var config = new UserConfig
        {
            TrailingEnabled    = true,
            TrailingActivateAt = 10_000m,
            LockProfitAt       = 3_000m,
        };

        var result = TrailingStopCalculator.Evaluate(10_000m, config, new UserRiskState());

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeTrue();
        result.NewStop.Should().Be(3_000m);
        result.NewLastTrigger.Should().Be(10_000m);
    }

    [Fact]
    public void ReturnsActivation_WhenMtmAboveThreshold()
    {
        var config = new UserConfig
        {
            TrailingEnabled    = true,
            TrailingActivateAt = 10_000m,
            LockProfitAt       = 3_000m,
        };

        var result = TrailingStopCalculator.Evaluate(12_000m, config, new UserRiskState());

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeTrue();
    }

    // ── Already active ────────────────────────────────────────────────────────

    [Fact]
    public void ReturnsNull_WhenActiveButGainLessThanOneStep()
    {
        var config = new UserConfig
        {
            TrailingEnabled      = true,
            WhenProfitIncreasesBy = 1_000m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 10_999 - 10_000 = 999, which is < 1 step (1_000)
        TrailingStopCalculator.Evaluate(10_999m, config, state)
            .Should().BeNull();
    }

    [Fact]
    public void RaisesFloor_WhenGainEqualsExactlyOneStep()
    {
        var config = new UserConfig
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 1_000m,
            IncreaseTrailingBy    = 500m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 11_000 - 10_000 = 1_000 = exactly 1 step
        var result = TrailingStopCalculator.Evaluate(11_000m, config, state);

        result.Should().NotBeNull();
        result!.IsActivation.Should().BeFalse();
        result.NewStop.Should().Be(3_500m);           // 3_000 + 1 × 500
        result.NewLastTrigger.Should().Be(11_000m);   // 10_000 + 1 × 1_000
    }

    [Fact]
    public void RaisesFloor_ByIntegerStepsOnly_WhenGainIs2Point5Steps()
    {
        var config = new UserConfig
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 1_000m,
            IncreaseTrailingBy    = 500m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 3_000m,
            TrailingLastTrigger = 10_000m,
        };

        // gain = 12_500 - 10_000 = 2_500 = 2.5 steps → only 2 steps used
        var result = TrailingStopCalculator.Evaluate(12_500m, config, state);

        result.Should().NotBeNull();
        result!.NewStop.Should().Be(4_000m);          // 3_000 + 2 × 500
        result.NewLastTrigger.Should().Be(12_000m);   // 10_000 + 2 × 1_000
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
dotnet test backend/KAITerminal.Tests --filter "FullyQualifiedName~TrailingStopCalculatorTests"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.Tests/RiskEngine/TrailingStopCalculatorTests.cs
git commit -m "test: add TrailingStopCalculator tests"
```

---

## Task 4: `RiskDecisionCalculator` tests

**Files:**
- Create: `backend/KAITerminal.Tests/RiskEngine/RiskDecisionCalculatorTests.cs`

- [ ] **Step 1: Create the test file**

Create `backend/KAITerminal.Tests/RiskEngine/RiskDecisionCalculatorTests.cs`:

```csharp
using FluentAssertions;
using KAITerminal.RiskEngine.Models;
using KAITerminal.RiskEngine.Services;

namespace KAITerminal.Tests.RiskEngine;

public class RiskDecisionCalculatorTests
{
    // Baseline config: trailing off, auto-square-off off.
    // All thresholds explicit so tests aren't affected by UserConfig default values.
    private static UserConfig BaseConfig() => new()
    {
        MtmSl                = -10_000m,
        MtmTarget            = 20_000m,
        TrailingEnabled      = false,
        AutoSquareOffEnabled = false,
        TrailingActivateAt   = 10_000m,
        LockProfitAt         = 3_000m,
        WhenProfitIncreasesBy = 1_000m,
        IncreaseTrailingBy   = 500m,
        AutoSquareOffTime    = new TimeSpan(15, 20, 0),
    };

    // ── MTM Stop-Loss ─────────────────────────────────────────────────────────

    [Fact]
    public void ExitMtmSl_WhenMtmAtSlBoundary()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmSl, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }

    [Fact]
    public void ExitMtmSl_WhenMtmBelowSl()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmSl - 1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }

    // ── Profit Target ─────────────────────────────────────────────────────────

    [Fact]
    public void ExitTarget_WhenMtmAtTargetBoundary()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmTarget, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTarget);
    }

    [Fact]
    public void ExitTarget_WhenMtmAboveTarget()
    {
        var config   = BaseConfig();
        var decision = RiskDecisionCalculator.Evaluate(config.MtmTarget + 1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTarget);
    }

    // ── Auto Square-Off ───────────────────────────────────────────────────────

    [Fact]
    public void ExitAutoSquareOff_WhenEnabledAndTimeReached()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = true };
        // nowIst exactly equals configured time
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), config.AutoSquareOffTime);
        decision.Kind.Should().Be(RiskDecisionKind.ExitAutoSquareOff);
    }

    [Fact]
    public void ExitAutoSquareOff_WhenEnabledAndTimePassed()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = true };
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), config.AutoSquareOffTime + TimeSpan.FromMinutes(1));
        decision.Kind.Should().Be(RiskDecisionKind.ExitAutoSquareOff);
    }

    [Fact]
    public void None_WhenAutoSquareOffDisabled()
    {
        var config = BaseConfig() with { AutoSquareOffEnabled = false };
        var decision = RiskDecisionCalculator.Evaluate(0m, config, new UserRiskState(), new TimeSpan(23, 59, 59));
        decision.Kind.Should().Be(RiskDecisionKind.None);
    }

    // ── Trailing Stop Loss ────────────────────────────────────────────────────

    [Fact]
    public void None_WhenTrailingInactiveAndBelowThreshold()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        var decision = RiskDecisionCalculator.Evaluate(5_000m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.None);
        decision.TrailingUpdate.Should().BeNull();
    }

    [Fact]
    public void TrailingActivation_ReturnsNoneWithActivationUpdate()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        // MTM exactly at activation threshold
        var decision = RiskDecisionCalculator.Evaluate(config.TrailingActivateAt, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.None);
        decision.TrailingUpdate.Should().NotBeNull();
        decision.TrailingUpdate!.IsActivation.Should().BeTrue();
        decision.TrailingUpdate.NewStop.Should().Be(config.LockProfitAt);
    }

    [Fact]
    public void ExitTrailingSl_WhenActiveAndMtmHitsExistingFloor()
    {
        var config = BaseConfig() with { TrailingEnabled = true };
        var state  = new UserRiskState { TrailingActive = true, TrailingStop = 5_000m };
        // MTM exactly at existing floor
        var decision = RiskDecisionCalculator.Evaluate(5_000m, config, state, TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTrailingSl);
    }

    [Fact]
    public void ExitTrailingSl_WhenFloorRaisedThisTickAndImmediatelyHit()
    {
        // Floor raise is huge relative to current MTM, so the raised floor instantly exceeds MTM.
        // State: active, LastTrigger=0, current floor=8_000.
        // Config: raise by 5_000 every 100 gain.
        // MTM = 100 → gain = 100 = 1 step → new floor = 8_000 + 5_000 = 13_000.
        // mtm 100 ≤ 13_000 → ExitTrailingSl.
        var config = BaseConfig() with
        {
            TrailingEnabled       = true,
            WhenProfitIncreasesBy = 100m,
            IncreaseTrailingBy    = 5_000m,
        };
        var state = new UserRiskState
        {
            TrailingActive      = true,
            TrailingStop        = 8_000m,
            TrailingLastTrigger = 0m,
        };

        var decision = RiskDecisionCalculator.Evaluate(100m, config, state, TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitTrailingSl);
    }

    // ── Priority order ────────────────────────────────────────────────────────

    [Fact]
    public void SlCheckedBeforeTarget_WhenBothSatisfied()
    {
        // Degenerate config: target (−2) is below SL (−1), so MTM = −1 satisfies both.
        // Correct order: SL fires first.
        var config = BaseConfig() with { MtmSl = -1m, MtmTarget = -2m };
        var decision = RiskDecisionCalculator.Evaluate(-1m, config, new UserRiskState(), TimeSpan.Zero);
        decision.Kind.Should().Be(RiskDecisionKind.ExitMtmSl);
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
dotnet test backend/KAITerminal.Tests --filter "FullyQualifiedName~RiskDecisionCalculatorTests"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.Tests/RiskEngine/RiskDecisionCalculatorTests.cs
git commit -m "test: add RiskDecisionCalculator tests"
```

---

## Task 5: `UserRiskState` tests

**Files:**
- Create: `backend/KAITerminal.Tests/RiskEngine/UserRiskStateTests.cs`

- [ ] **Step 1: Create the test file**

Create `backend/KAITerminal.Tests/RiskEngine/UserRiskStateTests.cs`:

```csharp
using FluentAssertions;
using KAITerminal.RiskEngine.Models;

namespace KAITerminal.Tests.RiskEngine;

public class UserRiskStateTests
{
    // ── Re-entry counts ───────────────────────────────────────────────────────

    [Fact]
    public void IncrementReentryCount_StartsAtOne()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("NIFTY25JAN2323000CE").Should().Be(1);
    }

    [Fact]
    public void IncrementReentryCount_IncrementsOnSubsequentCalls()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("NIFTY25JAN2323000CE");
        state.IncrementReentryCount("NIFTY25JAN2323000CE").Should().Be(2);
    }

    [Fact]
    public void IncrementReentryCount_CountersAreIndependentPerSymbol()
    {
        var state = new UserRiskState();
        state.IncrementReentryCount("SYMBOL_A");
        state.IncrementReentryCount("SYMBOL_A");
        state.IncrementReentryCount("SYMBOL_B").Should().Be(1);
    }

    // ── Auto-shift counts ─────────────────────────────────────────────────────

    [Fact]
    public void IncrementAutoShiftCount_StartsAtOne()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000").Should().Be(1);
    }

    [Fact]
    public void IncrementAutoShiftCount_IncrementsOnSubsequentCalls()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000");
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000").Should().Be(2);
    }

    [Fact]
    public void IncrementAutoShiftCount_CountersAreIndependentPerChainKey()
    {
        var state = new UserRiskState();
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_PE_22000");
        state.IncrementAutoShiftCount("NIFTY_2026-04-17_CE_22000").Should().Be(1);
    }

    // ── Shift origin map ──────────────────────────────────────────────────────

    [Fact]
    public void MapShiftOrigin_RoundTrips()
    {
        var state = new UserRiskState();
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_22000");
        state.ShiftOriginMap["NSE_FO|123456"].Should().Be("NIFTY_2026-04-17_PE_22000");
    }

    [Fact]
    public void MapShiftOrigin_OverwritesExistingEntry()
    {
        var state = new UserRiskState();
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_22000");
        state.MapShiftOrigin("NSE_FO|123456", "NIFTY_2026-04-17_PE_21900");
        state.ShiftOriginMap["NSE_FO|123456"].Should().Be("NIFTY_2026-04-17_PE_21900");
    }

    // ── Exited chain keys ─────────────────────────────────────────────────────

    [Fact]
    public void MarkChainExited_AddsKeyToSet()
    {
        var state = new UserRiskState();
        state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        state.ExitedChainKeys.Should().Contain("NIFTY_2026-04-17_PE_22000");
    }

    [Fact]
    public void MarkChainExited_IsIdempotent()
    {
        var state = new UserRiskState();
        state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        var act = () => state.MarkChainExited("NIFTY_2026-04-17_PE_22000");
        act.Should().NotThrow();
        state.ExitedChainKeys.Should().HaveCount(1);
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
dotnet test backend/KAITerminal.Tests --filter "FullyQualifiedName~UserRiskStateTests"
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/KAITerminal.Tests/RiskEngine/UserRiskStateTests.cs
git commit -m "test: add UserRiskState tests"
```

---

## Task 6: `PositionMapper` tests

**Files:**
- Create: `backend/KAITerminal.Tests/Api/PositionMapperTests.cs`

Note: `PositionMapper` is `internal` in `KAITerminal.Api`. The `InternalsVisibleTo` added in Task 1 makes it accessible here.

- [ ] **Step 1: Create the test file**

Create `backend/KAITerminal.Tests/Api/PositionMapperTests.cs`:

```csharp
using FluentAssertions;
using KAITerminal.Api.Dto.Enums;
using KAITerminal.Api.Mapping;
using KAITerminal.Contracts.Domain;

namespace KAITerminal.Tests.Api;

public class PositionMapperTests
{
    // Helper: build a minimal BrokerPosition with just the product field set.
    private static BrokerPosition PositionWith(string product) =>
        new() { Product = product };

    // Helper: build a minimal BrokerOrder with specific fields set.
    private static BrokerOrder OrderWith(
        string product         = "I",
        string orderType       = "MARKET",
        string transactionType = "BUY",
        string validity        = "DAY")
        => new()
        {
            Product         = product,
            OrderType       = orderType,
            TransactionType = transactionType,
            Validity        = validity,
        };

    // ── Product type mapping (position) ───────────────────────────────────────

    [Theory]
    [InlineData("D")]
    [InlineData("CNC")]
    [InlineData("NRML")]
    public void Product_MapsToDelivery(string raw)
    {
        PositionWith(raw).ToResponse().Product.Should().Be(ProductType.Delivery);
    }

    [Fact]
    public void Product_MapsToMtf()
    {
        PositionWith("MTF").ToResponse().Product.Should().Be(ProductType.Mtf);
    }

    [Fact]
    public void Product_MapsToCoverOrder()
    {
        PositionWith("CO").ToResponse().Product.Should().Be(ProductType.CoverOrder);
    }

    [Theory]
    [InlineData("I")]
    [InlineData("MIS")]
    [InlineData("UNKNOWN")]
    public void Product_MapsToIntraday_ForIntradayAndUnknownValues(string raw)
    {
        PositionWith(raw).ToResponse().Product.Should().Be(ProductType.Intraday);
    }

    // ── Order type mapping ────────────────────────────────────────────────────

    [Fact]
    public void OrderType_MapsToLimit()
    {
        OrderWith(orderType: "LIMIT").ToResponse().OrderType.Should().Be(TradeOrderType.Limit);
    }

    [Fact]
    public void OrderType_MapsToStopLoss()
    {
        OrderWith(orderType: "SL").ToResponse().OrderType.Should().Be(TradeOrderType.StopLoss);
    }

    [Fact]
    public void OrderType_MapsToStopLossMarket()
    {
        OrderWith(orderType: "SL-M").ToResponse().OrderType.Should().Be(TradeOrderType.StopLossMarket);
    }

    [Theory]
    [InlineData("MARKET")]
    [InlineData("UNKNOWN")]
    public void OrderType_MapsToMarket_ForMarketAndUnknownValues(string raw)
    {
        OrderWith(orderType: raw).ToResponse().OrderType.Should().Be(TradeOrderType.Market);
    }

    // ── Order side mapping ────────────────────────────────────────────────────

    [Fact]
    public void TransactionType_MapsToSell()
    {
        OrderWith(transactionType: "SELL").ToResponse().TransactionType.Should().Be(OrderSide.Sell);
    }

    [Fact]
    public void TransactionType_MapsToBuy()
    {
        OrderWith(transactionType: "BUY").ToResponse().TransactionType.Should().Be(OrderSide.Buy);
    }

    [Fact]
    public void TransactionType_IsCaseInsensitive()
    {
        OrderWith(transactionType: "sell").ToResponse().TransactionType.Should().Be(OrderSide.Sell);
    }

    // ── Validity mapping ──────────────────────────────────────────────────────

    [Fact]
    public void Validity_MapsToIoc()
    {
        OrderWith(validity: "IOC").ToResponse().Validity.Should().Be(OrderValidity.IOC);
    }

    [Fact]
    public void Validity_MapsToDay_ForDayAndOtherValues()
    {
        OrderWith(validity: "DAY").ToResponse().Validity.Should().Be(OrderValidity.Day);
        OrderWith(validity: "UNKNOWN").ToResponse().Validity.Should().Be(OrderValidity.Day);
    }
}
```

- [ ] **Step 2: Run the tests**

```bash
dotnet test backend/KAITerminal.Tests --filter "FullyQualifiedName~PositionMapperTests"
```

Expected: all tests pass.

- [ ] **Step 3: Run the full suite to confirm nothing is broken**

```bash
dotnet test backend/KAITerminal.Tests
```

Expected: all tests pass, 0 failures.

- [ ] **Step 4: Commit**

```bash
git add backend/KAITerminal.Tests/Api/PositionMapperTests.cs
git commit -m "test: add PositionMapper tests"
```
