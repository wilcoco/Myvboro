type Row = {
  userId: string;
  displayName: string | null;
  totalInvested: number;
  dividendsReceived: number;
  equity: number;
};

export default function InvestorsTable({ investors }: { investors: Row[] }) {
  if (investors.length === 0) {
    return <div className="text-sm text-muted">아직 투자자가 없습니다.</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs uppercase text-muted">
          <tr>
            <th className="px-3 py-2">투자자</th>
            <th className="px-3 py-2 text-right">출자</th>
            <th className="px-3 py-2 text-right">배당</th>
            <th className="px-3 py-2 text-right">지분</th>
          </tr>
        </thead>
        <tbody>
          {investors.map((r) => (
            <tr key={r.userId} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">
                {r.displayName ?? r.userId.slice(0, 8)}
              </td>
              <td className="px-3 py-2 text-right">{r.totalInvested.toLocaleString()}P</td>
              <td className="px-3 py-2 text-right text-accent">
                +{r.dividendsReceived.toLocaleString()}P
              </td>
              <td className="px-3 py-2 text-right">{(r.equity * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
