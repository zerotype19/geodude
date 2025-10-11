import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApiKey } from "../hooks/useApiKey";
import { createProject, createProperty, verifyProperty, startAudit } from "../services/api";

export default function Onboard() {
  const { apiKey, save: saveKey } = useApiKey();
  const navigate = useNavigate();

  // step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // step 1
  const [name, setName] = useState("My Project");
  const [email, setEmail] = useState("");

  // step 2
  const [projectId, setProjectId] = useState("");
  const [domain, setDomain] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [dnsName, setDnsName] = useState("");
  const [htmlPath, setHtmlPath] = useState("");

  // step 3
  const [method, setMethod] = useState<"dns" | "html">("html");
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState(false);

  async function doCreateProject() {
    setErr(null);
    try {
      const p = await createProject({ name, owner_email: email });
      setProjectId(p.id);
      saveKey(p.api_key);
      setStep(2);
    } catch (e: any) {
      setErr(e.message || "Failed to create project");
    }
  }

  async function doCreateProperty() {
    setErr(null);
    try {
      const pr = await createProperty({ project_id: projectId, domain }, apiKey);
      setPropertyId(pr.id);
      setVerifyToken(pr.verification.token);
      setDnsName(pr.verification.dns.name);
      setHtmlPath(pr.verification.html.path);
      setStep(3);
    } catch (e: any) {
      setErr(e.message || "Failed to add domain");
    }
  }

  async function doVerify() {
    setErr(null);
    setVerifying(true);
    try {
      const r = await verifyProperty(propertyId, method, apiKey);
      if (r.verified) {
        setVerified(true);
      } else {
        setErr(r.error || "Not verified yet — give DNS/HTML a minute, then retry.");
      }
    } catch (e: any) {
      setErr(e.message || "Verification failed");
    }
    setVerifying(false);
  }

  async function doRunFirstAudit() {
    setErr(null);
    setRunningAudit(true);
    try {
      const result = await startAudit(propertyId, apiKey);
      // Navigate to share link
      navigate(`/a/${result.id}`);
    } catch (e: any) {
      setErr(e.message || "Failed to start audit");
      setRunningAudit(false);
    }
  }

  return (
    <div className="card">
      <h2 style={{ marginTop: 0 }}>Onboard your site</h2>
      {err && (
        <div
          style={{
            color: "#fca5a5",
            marginBottom: 8,
            padding: 12,
            background: "#7f1d1d",
            borderRadius: 8,
          }}
        >
          {err}
        </div>
      )}

      {step === 1 && (
        <div>
          <h3>Step 1 — Create project</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <input
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Owner email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button onClick={doCreateProject} disabled={!name || !email}>
              Create project
            </button>
          </div>
          {apiKey && (
            <p style={{ opacity: 0.8, marginTop: 8 }}>
              API key saved to this browser.
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Step 2 — Add your domain</h3>
          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <div>
              Project: <code>{projectId}</code>
            </div>
            <input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <button onClick={doCreateProperty} disabled={!domain}>
              Add domain
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3>Step 3 — Verify ownership</h3>
          <p>Choose one method and apply it on your site, then click Verify.</p>

          <div
            className="card"
            style={{ background: "#f8fafc", marginBottom: 12 }}
          >
            <b>HTML file (fastest)</b>
            <div style={{ marginTop: 8 }}>
              Path: <code>{htmlPath}</code>
            </div>
            <div style={{ marginTop: 4 }}>
              File content: <code>{verifyToken}</code>
            </div>
          </div>

          <div
            className="card"
            style={{ background: "#f8fafc", marginBottom: 12 }}
          >
            <b>DNS TXT</b>
            <div style={{ marginTop: 8 }}>
              Name: <code>{dnsName}</code>
            </div>
            <div style={{ marginTop: 4 }}>
              Value: <code>{verifyToken}</code>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ marginRight: 16 }}>
              <input
                type="radio"
                checked={method === "html"}
                onChange={() => setMethod("html")}
              />{" "}
              HTML
            </label>
            <label>
              <input
                type="radio"
                checked={method === "dns"}
                onChange={() => setMethod("dns")}
              />{" "}
              DNS TXT
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={doVerify} disabled={verifying}>
              {verifying ? "Verifying…" : "Verify now"}
            </button>
            {verified && (
              <button
                onClick={doRunFirstAudit}
                disabled={runningAudit}
                style={{ background: "#10b981" }}
              >
                {runningAudit ? "Running audit…" : "Run first audit →"}
              </button>
            )}
          </div>

          {!verified && (
            <p style={{ opacity: 0.8, marginTop: 8, fontSize: 14 }}>
              Tip: HTML file usually verifies instantly; DNS may take minutes.
            </p>
          )}

          {verified && !runningAudit && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                background: "#065f46",
                borderRadius: 8,
                color: "#d1fae5",
              }}
            >
              ✅ Domain verified! Ready to run your first audit.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

