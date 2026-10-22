import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { checkLocalNetworkPermission } from '../utils/LocalNetworkUtils';
import { t } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';

interface FormData {
  printerName: string;
  ipAddress: string;
}

interface FormErrors {
  printerName?: string;
  ipAddress?: string;
}

const validationSchema = yup.object().shape({
  printerName: yup
    .string()
    .required(t('addPrinter.nomeObrigatorio'))
    .min(2, t('addPrinter.nomeMinimo'))
    .max(50, t('addPrinter.nomeMaximo')),
  ipAddress: yup.string().required(t('addPrinter.ipObrigatorio')),
});

export const AddEditPrinterScreen = () => {
  const { tema } = useTheme();
  const navigation = useNavigation<any>();
  const { addPrinter } = usePrinterConnections();
  const [formData, setFormData] = useState<FormData>({
    printerName: '',
    ipAddress: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState<keyof FormData | null>(null);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await validationSchema.validate(formData, { abortEarly: false });
      const hasNetworkAccess = await checkLocalNetworkPermission();
      if (!hasNetworkAccess) {
        setIsSubmitting(false);
        return;
      }
      addPrinter(formData.printerName.trim(), formData.ipAddress.trim());
      navigation.goBack();
    } catch (validationErrors: any) {
      const newErrors: FormErrors = {};
      validationErrors.inner?.forEach((error: any) => {
        newErrors[error.path as keyof FormErrors] = error.message;
      });
      setErrors(newErrors);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldClass = (field: keyof FormData) =>
    `rounded-xl border bg-cartao px-4 py-3.5 text-[15px] text-ink ${
      errors[field]
        ? 'border-state-danger'
        : focused === field
          ? 'border-brand'
          : 'border-line'
    }`;

  const canSave = formData.printerName.length >= 2 && formData.ipAddress.length > 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-canvas">
      <Header
        title={t('addPrinter.title')}
        subtitle={t('addPrinter.configManual')}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-xl2 border border-line bg-cartao p-4">
          <Text className="text-[10px] tracking-widest font-semibold text-ink-soft">
            {t('addPrinter.seccaoImpressora')}
          </Text>

          <Text className="mt-4 mb-1.5 text-[12px] font-medium text-ink-soft">
            {t('addPrinter.nome')}
          </Text>
          <TextInput
            className={fieldClass('printerName')}
            placeholder="Centauri Carbon"
            placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
            value={formData.printerName}
            onChangeText={value => handleInputChange('printerName', value)}
            onFocus={() => setFocused('printerName')}
            onBlur={() => setFocused(null)}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {errors.printerName && (
            <Text className="mt-1.5 text-[12px] text-state-danger">
              {errors.printerName}
            </Text>
          )}

          <View className="mt-4 flex-row items-center justify-between mb-1.5">
            <Text className="text-[12px] font-medium text-ink-soft">
              {t('addPrinter.enderecoIp')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('WhereIsIp')}
              activeOpacity={0.7}
            >
              <Text className="text-[12px] font-semibold text-brand-texto">
                {t('addPrinter.ondeEncontrar')}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            className={fieldClass('ipAddress')}
            placeholder="192.168.1.9"
            placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
            value={formData.ipAddress}
            onChangeText={value => handleInputChange('ipAddress', value)}
            onFocus={() => setFocused('ipAddress')}
            onBlur={() => setFocused(null)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={{ fontFamily: 'monospace' }}
          />
          {errors.ipAddress ? (
            <Text className="mt-1.5 text-[12px] text-state-danger">
              {errors.ipAddress}
            </Text>
          ) : (
            <Text className="mt-1.5 text-[11px] text-ink-muted">
              {t('addPrinter.ipDica')}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.85}
          className={`mt-4 rounded-xl2 py-4 items-center ${
            canSave && !isSubmitting ? 'bg-brand' : 'bg-line'
          }`}
        >
          <Text className="text-[15px] font-semibold text-white">
            {isSubmitting ? t('addPrinter.aGuardar') : t('addPrinter.guardar')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Discovery')}
          activeOpacity={0.7}
          className="mt-3 py-3 flex-row items-center justify-center"
        >
          <Ionicons name="wifi" size={16} color={hexDe(tema.paleta.tintaSoft)} />
          <Text className="ml-2 text-[13px] font-semibold text-ink-soft">
            {t('addPrinter.analisarRede')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
