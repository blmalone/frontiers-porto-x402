import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface SequenceDiagramProps {
  title: string;
  diagramDefinition: string;
  idPrefix?: string;
}

export const SequenceDiagram = ({ title, diagramDefinition, idPrefix = 'diagram' }: SequenceDiagramProps) => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!elementRef.current) return;

      mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'default',
        sequence: {
          useMaxWidth: true,
          wrap: true
        }
      });

      try {
        const { svg } = await mermaid.render(`${idPrefix}-${Date.now()}`, diagramDefinition);
        elementRef.current.innerHTML = svg;
        
        // Ensure SVG stays within container bounds
        const svgElement = elementRef.current.querySelector('svg');
        if (svgElement) {
          svgElement.style.maxWidth = '100%';
          svgElement.style.height = 'auto';
        }
      } catch (error) {
        console.error('Mermaid error:', error);
        elementRef.current.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Payment Flow: User ↔ Server</div>';
      }
    };

    renderDiagram();
  }, [diagramDefinition, idPrefix]);

  return (
    <div 
      style={{
        margin: '16px auto',
        padding: '20px',
        background: '#f5f5f0',
        borderRadius: '12px',
        border: '1px solid #e0e0e0',
        textAlign: 'center',
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px', color: '#2c3e50' }}>
        {title}
      </div>
      <div 
        ref={elementRef} 
        style={{ 
          minHeight: '600px', 
          width: '100%', 
          overflow: 'hidden',
          textAlign: 'center'
        }} 
      />
    </div>
  );
}; 