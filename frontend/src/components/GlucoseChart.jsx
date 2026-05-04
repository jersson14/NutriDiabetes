'use client';

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function GlucoseChart({ data, type = 'line', height = 300, showLegend = true }) {
  const chartProps = {
    data,
    margin: { top: 5, right: 30, left: 0, bottom: 5 },
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-50/50 to-white rounded-2xl p-6 border border-blue-100">
      <ResponsiveContainer width="100%" height={height}>
        {type === 'line' ? (
          <LineChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="name" stroke="#999" />
            <YAxis stroke="#999" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '2px solid #005BAC',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,91,172,0.15)',
              }}
              cursor={{ stroke: '#005BAC', strokeWidth: 2 }}
            />
            {showLegend && <Legend />}
            <Line
              type="monotone"
              dataKey="glucosa"
              stroke="#005BAC"
              strokeWidth={3}
              dot={{ fill: '#005BAC', r: 5 }}
              activeDot={{ r: 7 }}
            />
            <Line
              type="monotone"
              dataKey="meta"
              stroke="#00A859"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#00A859', r: 4 }}
            />
          </LineChart>
        ) : (
          <BarChart {...chartProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="name" stroke="#999" />
            <YAxis stroke="#999" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '2px solid #005BAC',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,91,172,0.15)',
              }}
            />
            {showLegend && <Legend />}
            <Bar dataKey="glucosa" fill="#005BAC" radius={[8, 8, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
