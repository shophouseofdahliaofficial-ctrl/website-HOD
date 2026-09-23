'use client';

import styles from '../terms/page.module.css';

export default function SizeGuidePage() {
  const sizeChart = [
    { size: 'XS', bust: '32"', waist: '25"', hip: '35"' },
    { size: 'S', bust: '34"', waist: '27"', hip: '37"' },
    { size: 'M', bust: '36"', waist: '29"', hip: '39"' },
    { size: 'L', bust: '38"', waist: '31"', hip: '41"' },
    { size: 'XL', bust: '40"', waist: '33"', hip: '43"' },
    { size: 'XXL', bust: '42"', waist: '35"', hip: '45"' },
  ];

  return (
    <div className={styles.container} style={{ maxWidth: '840px', margin: '0 auto', padding: '5rem 1.5rem 4rem' }}>
      <h1 className={styles.title} style={{ fontFamily: 'var(--font-instrument-serif), Georgia, serif', fontSize: '3rem', fontWeight: 400, color: '#111', marginBottom: '1.5rem' }}>
        Size Guide
      </h1>
      <div className={styles.content} style={{ color: '#444', lineHeight: 1.8, fontSize: '1.05rem' }}>
        <p>
          Find your perfect fit. Our garments are tailored to accentuate silhouette and drape effortlessly. All measurements below are shown in inches.
        </p>

        <div style={{ overflowX: 'auto', margin: '2rem 0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e5e5e5' }}>
            <thead>
              <tr style={{ background: '#f8f6f8', borderBottom: '1px solid #e5e5e5' }}>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: '#111' }}>Size</th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: '#111' }}>Bust</th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: '#111' }}>Waist</th>
                <th style={{ padding: '14px 18px', fontWeight: 600, color: '#111' }}>Hip</th>
              </tr>
            </thead>
            <tbody>
              {sizeChart.map((row) => (
                <tr key={row.size} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '12px 18px', fontWeight: 600, color: '#AF5D6A' }}>{row.size}</td>
                  <td style={{ padding: '12px 18px', color: '#555' }}>{row.bust}</td>
                  <td style={{ padding: '12px 18px', color: '#555' }}>{row.waist}</td>
                  <td style={{ padding: '12px 18px', color: '#555' }}>{row.hip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '0.75rem', color: '#111', fontSize: '1.35rem', fontFamily: 'var(--font-instrument-serif), Georgia, serif' }}>
          How to Measure
        </h3>
        <p>
          <strong>Bust:</strong> Measure around the fullest part of your bust, keeping the tape parallel to the floor.<br />
          <strong>Waist:</strong> Measure around the narrowest point of your natural waist.<br />
          <strong>Hip:</strong> Stand with feet together and measure around the fullest part of your hips.
        </p>
      </div>
    </div>
  );
}
