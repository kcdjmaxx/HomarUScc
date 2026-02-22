// CRC: crc-AppsFrontend.md
import { useEffect, useState } from "react";

interface AppManifest {
  name: string;
  slug: string;
  description: string;
  version: string;
  icon?: string;
}

const apiBase = `http://${window.location.hostname}:${window.location.port || 3120}`;

export function AppsView() {
  const [apps, setApps] = useState<AppManifest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [appData, setAppData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${apiBase}/api/apps`)
      .then((r) => r.json())
      .then(setApps)
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
      <div style={styles.container}>
        <button onClick={() => setSelected(null)} style={styles.backBtn}>
          &larr; All Apps
        </button>
        <AppRenderer app={selectedApp} data={appData} />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Apps</h2>
        <span style={styles.count}>{apps.length} installed</span>
      </div>
      {apps.length === 0 && (
        <div style={styles.empty}>No apps installed. Ask Caul to build one.</div>
      )}
      <div style={styles.grid}>
        {apps.map((app) => (
          <button
            key={app.slug}
            onClick={() => setSelected(app.slug)}
            style={styles.card}
          >
            {app.icon && (
              <img
                src={`${apiBase}/api/apps/${app.slug}/static/${app.icon}`}
                alt={app.name}
                style={styles.icon}
              />
            )}
            <div style={styles.cardText}>
              <div style={styles.cardName}>{app.name}</div>
              <div style={styles.cardDesc}>{app.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function AppRenderer({ app, data }: { app: AppManifest; data: Record<string, unknown> | null }) {
  // For now, render app data as a simple view. Dynamic component loading comes later.
  return (
    <div style={styles.appContainer}>
      <div style={styles.appHeader}>
        {app.icon && (
          <img
            src={`${apiBase}/api/apps/${app.slug}/static/${app.icon}`}
            alt={app.name}
            style={styles.appIcon}
          />
        )}
        <div>
          <h2 style={styles.appTitle}>{app.name}</h2>
          <span style={styles.appVersion}>v{app.version}</span>
        </div>
      </div>
      <p style={styles.appDesc}>{app.description}</p>
      {data && (
        <div style={styles.dataSection}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} style={styles.dataRow}>
              <span style={styles.dataKey}>{key}</span>
              <span style={styles.dataValue}>{String(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: 24,
    overflowY: "auto" as const,
  },
  header: {
    display: "flex",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  count: {
    fontSize: 12,
    color: "#8888a0",
  },
  empty: {
    color: "#8888a0",
    fontSize: 13,
    padding: "40px 0",
    textAlign: "center" as const,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260, 1fr))",
    gap: 16,
  },
  card: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 16,
    background: "#12121a",
    border: "1px solid #1e1e2e",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left" as const,
    fontFamily: "inherit",
    color: "#e0e0e8",
    transition: "border-color 0.15s",
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    objectFit: "cover" as const,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: "#8888a0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#c4b5fd",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 0",
    marginBottom: 16,
    fontFamily: "inherit",
  },
  appContainer: {
    maxWidth: 600,
    margin: "0 auto",
    textAlign: "center" as const,
  },
  appHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 12,
    objectFit: "cover" as const,
  },
  appTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: "#e0e0e8",
  },
  appVersion: {
    fontSize: 11,
    color: "#8888a0",
  },
  appDesc: {
    color: "#8888a0",
    fontSize: 13,
    marginBottom: 24,
  },
  dataSection: {
    background: "#12121a",
    border: "1px solid #1e1e2e",
    borderRadius: 10,
    padding: 16,
    textAlign: "left" as const,
  },
  dataRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    borderBottom: "1px solid #1e1e2e",
    fontSize: 13,
  },
  dataKey: {
    color: "#c4b5fd",
    fontWeight: 500,
  },
  dataValue: {
    color: "#e0e0e8",
  },
};
