import React from 'react';
import ScaledText from './ScaledText';

type Props = React.ComponentProps<typeof ScaledText>;

export const Title: React.FC<Props> = ({ style, children, ...rest }) => (
  <ScaledText baseSize={22} style={[{ fontWeight: '700', color: '#111827' }, style]} {...rest}>
    {children}
  </ScaledText>
);

export const Subtitle: React.FC<Props> = ({ style, children, ...rest }) => (
  <ScaledText baseSize={16} style={[{ fontWeight: '600', color: '#1F2937' }, style]} {...rest}>
    {children}
  </ScaledText>
);

export const Body: React.FC<Props> = ({ style, children, ...rest }) => (
  <ScaledText baseSize={14} style={[{ fontWeight: '400', color: '#374151' }, style]} {...rest}>
    {children}
  </ScaledText>
);

export const Caption: React.FC<Props> = ({ style, children, ...rest }) => (
  <ScaledText baseSize={12} style={[{ fontWeight: '500', color: '#6B7280' }, style]} {...rest}>
    {children}
  </ScaledText>
);


