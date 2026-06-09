import React from 'react';

interface BodyMapProps {
  highlightedOrgans?: string[];
}

export function BodyMap({ highlightedOrgans = [] }: BodyMapProps) {
  const isHighlighted = (organ: string) => highlightedOrgans.includes(organ);
  
  return (
    <div className="flex justify-center p-4">
      <svg viewBox="0 0 200 300" className="w-full max-w-xs">
        {/* Body outline */}
        <ellipse cx="100" cy="50" rx="30" ry="35" fill="#f0f0f0" stroke="#ccc" />
        <rect x="70" y="80" width="60" height="100" rx="10" fill="#f0f0f0" stroke="#ccc" />
        <rect x="80" y="180" width="40" height="100" rx="5" fill="#f0f0f0" stroke="#ccc" />
        
        {/* Heart */}
        <path 
          d="M85 55 C85 45, 75 45, 80 55 C80 65, 90 70, 95 75 C100 70, 110 65, 110 55 C110 45, 100 45, 95 55 C90 45, 80 45, 85 55"
          fill={isHighlighted('heart') ? '#e74c3c' : '#ff9999'}
          stroke="#c0392b"
          strokeWidth={isHighlighted('heart') ? '3' : '1'}
        />
        <text x="95" y="68" textAnchor="middle" fontSize="8" fill="white">Heart</text>
        
        {/* Liver */}
        <ellipse cx="130" cy="110" rx="18" ry="15" fill={isHighlighted('liver') ? '#9b59b6' : '#d7bde2'} stroke="#8e44ad" strokeWidth={isHighlighted('liver') ? '3' : '1'} />
        <text x="130" y="114" textAnchor="middle" fontSize="8" fill="white">Liver</text>
        
        {/* Kidneys */}
        <ellipse cx="80" cy="150" rx="10" ry="15" fill={isHighlighted('kidneys') ? '#34495e' : '#aeb6bf'} stroke="#2c3e50" strokeWidth={isHighlighted('kidneys') ? '3' : '1'} />
        <ellipse cx="120" cy="150" rx="10" ry="15" fill={isHighlighted('kidneys') ? '#34495e' : '#aeb6bf'} stroke="#2c3e50" strokeWidth={isHighlighted('kidneys') ? '3' : '1'} />
        <text x="100" y="155" textAnchor="middle" fontSize="8" fill="white">Kidneys</text>
        
        {/* GI */}
        <path d="M85 185 Q100 175, 115 185 Q120 200, 115 210 Q100 220, 85 210 Q80 200, 85 185" fill={isHighlighted('GI') ? '#f39c12' : '#fdebd0'} stroke="#d68910" strokeWidth={isHighlighted('GI') ? '3' : '1'} />
        <text x="100" y="200" textAnchor="middle" fontSize="8" fill="white">GI</text>
        
        {/* Blood */}
        <line x1="100" y1="90" x2="100" y2="270" stroke={isHighlighted('blood') ? '#c0392b' : '#e74c3c'} strokeWidth={isHighlighted('blood') ? '6' : '2'} strokeLinecap="round" />
        <text x="105" y="100" fontSize="7" fill="white">Blood</text>
      </svg>
    </div>
  );
}
