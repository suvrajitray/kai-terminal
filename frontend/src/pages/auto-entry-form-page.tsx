import { useMemo } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { toast } from "@/lib/toast";
import { BROKERS } from "@/lib/constants";
import { getLotSize } from "@/lib/lot-sizes";
import { useAutoEntry } from "@/hooks/use-auto-entry";
import { useBrokerStore } from "@/stores/broker-store";
import { PageHeader } from "./auto-entry-form/page-header";
import { TradeSettingsSection } from "./auto-entry-form/trade-settings-section";
import { ScheduleSection } from "./auto-entry-form/schedule-section";
import { StrikeSelectionSection } from "./auto-entry-form/strike-selection-section";
import { ExpirySection } from "./auto-entry-form/expiry-section";
import { StrategySidebar } from "./auto-entry-form/strategy-sidebar";
import { StickyActions } from "./auto-entry-form/sticky-actions";
import { useAutoEntryDraft } from "./auto-entry-form/use-auto-entry-draft";
import { strategyToInput } from "./auto-entry-form/utils";

export function AutoEntryFormPage() {
  const { id } = useParams<{ id?: string }>();
  const isNew = id === undefined;

  const connectedBrokers = useBrokerStore(useShallow((state) =>
    BROKERS.filter((broker) => state.isConnected(broker.id)),
  ));
  const defaultBrokerType = connectedBrokers[0]?.id ?? "upstox";
  const { strategies, loading, saving, create, update } = useAutoEntry();

  const strategyId = id ? Number(id) : null;
  const strategy = useMemo(
    () => strategies.find((current) => current.id === strategyId),
    [strategies, strategyId],
  );

  if (!isNew && loading) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  if (!isNew && !strategy) {
    return <Navigate to="/auto-entry" replace />;
  }

  return (
    <AutoEntryForm
      key={isNew ? `new:${defaultBrokerType}` : `edit:${strategyId}`}
      defaultBrokerType={defaultBrokerType}
      initialDraft={strategy ? strategyToInput(strategy) : undefined}
      connectedBrokers={connectedBrokers}
      isNew={isNew}
      saving={saving}
      strategyId={strategyId}
      create={create}
      update={update}
    />
  );
}

function AutoEntryForm({
  defaultBrokerType,
  initialDraft,
  connectedBrokers,
  isNew,
  saving,
  strategyId,
  create,
  update,
}: {
  defaultBrokerType: string;
  initialDraft?: ReturnType<typeof strategyToInput>;
  connectedBrokers: Array<{ id: string; name: string }>;
  isNew: boolean;
  saving: boolean;
  strategyId: number | null;
  create: ReturnType<typeof useAutoEntry>["create"];
  update: ReturnType<typeof useAutoEntry>["update"];
}) {
  const navigate = useNavigate();
  const { draft, setField, reset } = useAutoEntryDraft({
    brokerType: defaultBrokerType,
    initialDraft,
  });
  const lotSize = getLotSize(draft.instrument);
  const goBack = () => navigate("/auto-entry");

  async function handleSave() {
    try {
      if (isNew) {
        await create(draft);
        toast.success("Strategy created");
      } else if (strategyId !== null) {
        await update(strategyId, draft);
        toast.success("Strategy updated");
      }
      goBack();
    } catch {
      toast.error("Failed to save strategy");
    }
  }

  return (
    <div className="max-w-[1440px] mx-auto pb-24">
      <PageHeader
        draft={draft}
        isNew={isNew}
        brokers={connectedBrokers}
        onBack={goBack}
        onFieldChange={setField}
      />

      <div className="grid grid-cols-[1fr_300px] gap-8 items-start">
        <div>
          <TradeSettingsSection draft={draft} lotSize={lotSize} onFieldChange={setField} />
          <ScheduleSection draft={draft} onFieldChange={setField} />
          <StrikeSelectionSection draft={draft} onFieldChange={setField} />
          <ExpirySection draft={draft} onFieldChange={setField} />
        </div>

        <StrategySidebar draft={draft} lotSize={lotSize} />
      </div>

      <StickyActions saving={saving} onCancel={goBack} onReset={reset} onSave={handleSave} />
    </div>
  );
}
