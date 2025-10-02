import React from 'react';
import { Text, TextProps } from 'react-native';
import { useSettings } from '../src/context/SettingsContext';

type Props = TextProps & {
  baseSize?: number; // optional semantic base size in px; falls back to style.fontSize or 14
  children?: React.ReactNode;
};

const ScaledText: React.FC<Props> = ({ baseSize, style, children, ...rest }) => {
  const { textScale } = useSettings();
  const flattened = Array.isArray(style) ? Object.assign({}, ...style) : (style || {});
  const base = typeof baseSize === 'number' ? baseSize : (typeof (flattened as any).fontSize === 'number' ? (flattened as any).fontSize : 14);
  const scaledFontSize = Math.round(base * textScale);
  return (
    <Text {...rest} style={[style, { fontSize: scaledFontSize }]}>
      {children}
    </Text>
  );
};

export default ScaledText;


