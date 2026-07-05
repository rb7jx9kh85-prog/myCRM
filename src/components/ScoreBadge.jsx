export default function ScoreBadge({ score, redFlags = [], autoExcluded }) {
  const cls = score >= 50 ? "success" : score < 0 ? "danger" : "neutral";
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span className={`badge ${cls}`}>{score} pts</span>
      {redFlags.length > 0 && (
        <span className="badge danger" title={redFlags.join(", ")}>
          {autoExcluded ? "Exclu" : "À exclure"}
        </span>
      )}
    </span>
  );
}
