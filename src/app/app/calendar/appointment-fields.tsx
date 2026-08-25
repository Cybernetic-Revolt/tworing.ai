// Shared form fields for create/edit appointment forms (server-rendered).

const input =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const label = "flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300";

export function AppointmentFields({
  defaults,
}: {
  defaults?: {
    date?: string;
    time?: string;
    duration?: number;
    customerName?: string | null;
    customerPhone?: string | null;
    jobType?: string | null;
    address?: string | null;
    notes?: string | null;
  };
}) {
  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <label className={label}>
          Date
          <input type="date" name="date" required defaultValue={defaults?.date} className={input} />
        </label>
        <label className={label}>
          Time
          <input type="time" name="time" required defaultValue={defaults?.time} className={input} />
        </label>
        <label className={label}>
          Minutes
          <input
            type="number"
            name="duration"
            min={15}
            max={600}
            step={15}
            defaultValue={defaults?.duration ?? 120}
            className={input}
          />
        </label>
      </div>
      <label className={label}>
        Customer name
        <input name="customerName" required defaultValue={defaults?.customerName ?? ""} className={input} />
      </label>
      <label className={label}>
        Phone
        <input name="customerPhone" defaultValue={defaults?.customerPhone ?? ""} className={input} />
      </label>
      <label className={label}>
        Job type
        <input
          name="jobType"
          placeholder="e.g. Furnace — no heat"
          defaultValue={defaults?.jobType ?? ""}
          className={input}
        />
      </label>
      <label className={label}>
        Address
        <input name="address" defaultValue={defaults?.address ?? ""} className={input} />
      </label>
      <label className={label}>
        Notes
        <textarea name="notes" rows={3} defaultValue={defaults?.notes ?? ""} className={input} />
      </label>
    </>
  );
}
