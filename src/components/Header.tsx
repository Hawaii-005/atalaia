import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  leftAction?: {
    icon: string;
    onPress: () => void;
  };
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
  className?: string;
}

/**
 * Page header: title on the left, optional back chevron, optional action on the
 * right. No brand mark here — the icon already carries it.
 */
export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onBack,
  leftAction,
  rightAction,
  className = '',
}) => {
  const { tema } = useTheme();
  const leadingIcon = onBack ? 'chevron-back' : leftAction?.icon;
  const leadingPress = onBack ?? leftAction?.onPress;

  return (
    <View
      className={`flex-row items-center bg-canvas border-b border-line px-4 py-3 ${className}`}
    >
      {leadingPress && leadingIcon && (
        <TouchableOpacity
          onPress={leadingPress}
          className="w-9 h-9 -ml-2 mr-1 items-center justify-center rounded-xl"
          activeOpacity={0.6}
        >
          <Ionicons
            name={leadingIcon as any}
            size={22}
            color={hexDe(tema.paleta.tinta)}
          />
        </TouchableOpacity>
      )}

      <View className="flex-1">
        <Text
          className="text-[22px] font-bold text-ink tracking-tight"
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text className="text-xs text-ink-muted mt-0.5" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightAction ? (
        <TouchableOpacity
          onPress={rightAction.onPress}
          className="w-10 h-10 rounded-xl bg-canvas-sunken items-center justify-center"
          activeOpacity={0.6}
        >
          <Ionicons
            name={rightAction.icon as any}
            size={20}
            color={hexDe(tema.paleta.tinta)}
          />
        </TouchableOpacity>
      ) : (
        <View className="w-1" />
      )}
    </View>
  );
};
