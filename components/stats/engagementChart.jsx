import { formatDate } from '@/lib/i18n/runtime';
export default function EngagementChart({ data }) {
  const width = 640;
  const height = 200;
  const padding = 32;

  const maxValue = Math.max(1, ...data.map((point) => point.count));
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1);

  const points = data.map((point, index) => {
    const x = padding + index * stepX;
    const y = height - padding - (point.count / maxValue) * (height - padding * 2);
    return { x, y, ...point };
  });

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[480px]" style={{ maxHeight: 220 }}>
        <defs>
          <linearGradient id="engagementFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3D63E8" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3D63E8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E2E8F0" strokeWidth="1" />

        <path d={areaPath} fill="url(#engagementFill)" />
        <path d={linePath} fill="none" stroke="#3D63E8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {points.map((point) => (
          <g key={point.yearWeek}>
            <circle cx={point.x} cy={point.y} r="3.5" fill="#3D63E8" />
            <text x={point.x} y={height - padding + 16} textAnchor="middle" fontSize="10" fill="#94A3B8">
              {point.date ? formatDate(point.date, { day: 'numeric', month: 'short' }) : point.label}
            </text>
            {point.count > 0 && (
              <text x={point.x} y={point.y - 10} textAnchor="middle" fontSize="10" fill="#3D63E8" fontWeight="600">
                {point.count}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
