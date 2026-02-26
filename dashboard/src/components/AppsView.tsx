// CRC: crc-AppsFrontend.md | CRC: crc-ThemeProvider.md
import { useEffect, useState } from "react";
import { useTheme } from "../theme";
import { registerSkill, type ViewProps } from "../skills-registry";

interface AppManifest {
  name: string;
  slug: string;
  description: string;
  version: string;
  icon?: string;
  hasIndex?: boolean;
}

// Apps that have dedicated sidebar views -- hide from generic list
const DEDICATED_VIEWS = new Set(["kanban"]);

const apiBase = `http://${window.location.hostname}:${window.location.port || 3120}`;

// R364: AppsView with theme colors
export function AppsView() {
  const { theme } = useTheme();
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [appData, setAppData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/apps`)
      .then((r) => r.json())
      .then((all: AppManifest[]) => setApps(all.filter((a) => !DEDICATED_VIEWS.has(a.slug))))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setAppData(null); return; }
    fetch(`${apiBase}/api/apps/${selected}/data`)
      .then((r) => r.json())
      .then(setAppData)
      .catch(() => setAppData(null));
  }, [selected]);

  const selectedApp = apps.find((a) => a.slug === selected);

  if (selected && selectedApp) {
    return (
      <div style={{ flex: 1, padding: 24, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const }}>
        <button onClick={() => setSelected(null)} style={{
          background: "none",
          border: "none",
          color: theme.accent,
          fontSize: 13,
          cursor: "pointer",
          padding: "4px 0",
          marginBottom: 16,
          fontFamily: "inherit",
        }}>
          &larr; All Apps
        </button>
        <AppRenderer app={selectedApp} data={appData} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, padding: 24, overflowY: "auto" as const }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: theme.text }}>Apps</h2>
        <span style={{ fontSize: 12, color: theme.textMuted }}>{apps.length} installed</span>
      </div>
      {apps.length === 0 && (
        <div style={{ color: theme.textMuted, fontSize: 13, padding: "40px 0", textAlign: "center" as const }}>
          No apps installed. Ask Caul to build one.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {apps.map((app) => (
          <button
            key={app.slug}
            onClick={() => setSelected(app.slug)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "left" as const,
              fontFamily: "inherit",
              color: theme.text,
              transition: "border-color 0.15s",
            }}
          >
            {app.icon && (
              <img
                src={`${apiBase}/api/apps/${app.slug}/static/${app.icon}`}
                alt={app.name}
                style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover" as const }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{app.name}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {app.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppRenderer({ app, data }: { app: AppManifest; data: Record<string, unknown> | null }) {
  const { theme } = useTheme();

  if (app.hasIndex) {
    return (
      <iframe
        src={`${apiBase}/api/apps/${app.slug}/static/index.html`}
        style={{ width: "100%", flex: 1, border: "none", background: theme.bg, display: "block", minHeight: 0 }}
        title={app.name}
      />
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" as const }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 16 }}>
        {app.icon && (
          <img
            src={`${apiBase}/api/apps/${app.slug}/static/${app.icon}`}
            alt={app.name}
            style={{ width: 80, height: 80, borderRadius: 12, objectFit: "cover" as const }}
          />
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: theme.text }}>{app.name}</h2>
          <span style={{ fontSize: 11, color: theme.textMuted }}>v{app.version}</span>
        </div>
      </div>
      <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 24 }}>{app.description}</p>
      {data && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 16, textAlign: "left" as const }}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.border}`, fontSize: 13 }}>
              <span style={{ color: theme.accent, fontWeight: 500 }}>{key}</span>
              <span style={{ color: theme.text }}>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// R404: Self-register as sidebar skill at module scope (R420: ignores ViewProps)
registerSkill({
  id: "apps",
  name: "Apps",
  icon: "+",
  surface: "sidebar",
  component: AppsView as unknown as React.ComponentType<ViewProps>,
  order: 80,
  core: false,
});
