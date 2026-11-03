import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import * as yup from 'yup';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePrinterConnections } from '../contexts/PrinterConnectionsContext';
import { checkLocalNetworkPermission } from '../utils/LocalNetworkUtils';
import { eTailscale } from '../utils/rede';
import { t, useIdioma } from '../i18n';
import { useTheme } from '../contexts/ThemeContext';
import { hexDe } from '../theme/temas';
import { detectarTipoFirmware } from '../utils/PrinterDiscovery';
import { FirmwareFlavor } from '../types';

interface FormData {
  printerName: string;
  ipAddress: string;
  alternateIp: string;
  firmware: 'auto' | 'sdcp' | 'moonraker';
}

interface FormErrors {
  printerName?: string;
  ipAddress?: string;
  alternateIp?: string;
  firmware?: string;
}

const validationSchema = () =>
  yup.object().shape({
    printerName: yup
      .string()
      .required(t('addPrinter.nomeObrigatorio'))
      .min(2, t('addPrinter.nomeMinimo'))
      .max(50, t('addPrinter.nomeMaximo')),
    ipAddress: yup.string().required(t('addPrinter.ipObrigatorio')),
  });

export const AddEditPrinterScreen = () => {
  useIdioma();
  const { tema } = useTheme();
  const navigation = useNavigation<any>();
  const { addPrinter } = usePrinterConnections();
  const [formData, setFormData] = useState<FormData>({
    printerName: '',
    ipAddress: '',
    alternateIp: '',
    firmware: 'auto',
  });
  const [testResult, setTestResult] = useState<{
    status: 'success' | 'error';
    msg: string;
    details?: string;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState<keyof FormData | null>(null);

  const handleTestConnection = async () => {
    const ip = formData.ipAddress.trim();
    if (!ip) {
      setErrors(prev => ({
        ...prev,
        ipAddress: t('addPrinter.ipObrigatorio'),
      }));
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const startTime = Date.now();
    try {
      const res = await detectarTipoFirmware(ip);
      const latency = Date.now() - startTime;
      if (res?.flavor === 'moonraker') {
        setTestResult({
          status: 'success',
          msg: t('addPrinter.testeSucessoMoonraker'),
          details: `Latência: ${latency}ms · Servidor: Moonraker JSON-RPC`,
        });
      } else if (res?.flavor === 'sdcp') {
        setTestResult({
          status: 'success',
          msg: t('addPrinter.testeSucessoSdcp'),
          details: `Latência: ${latency}ms · Protocolo: SDCP Elegoo`,
        });
      } else {
        setTestResult({
          status: 'error',
          msg: t('addPrinter.testeFalhou'),
          details: `Tempo esgotado ou endereço inacessível (${latency}ms)`,
        });
      }
    } catch {
      setTestResult({
        status: 'error',
        msg: t('addPrinter.testeFalhou'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await validationSchema().validate(formData, { abortEarly: false });
      // Fora de casa (Tailscale) a permissão de rede local do Android não se
      // aplica: nesse caso não se bloqueia a gravação.
      const porTailscale =
        eTailscale(formData.ipAddress.trim()) ||
        eTailscale(formData.alternateIp.trim());
      if (!porTailscale) {
        const hasNetworkAccess = await checkLocalNetworkPermission();
        if (!hasNetworkAccess) {
          setIsSubmitting(false);
          return;
        }
      }
      let finalFlavor: FirmwareFlavor = 'sdcp';
      if (formData.firmware === 'auto') {
        try {
          const det = await detectarTipoFirmware(
            formData.ipAddress.trim(),
            2000
          );
          if (det?.flavor) {
            finalFlavor = det.flavor;
          }
        } catch {
          // Se falhar o auto, mantém o padrão
        }
      } else {
        finalFlavor = formData.firmware;
      }

      addPrinter(
        formData.printerName.trim(),
        formData.ipAddress.trim(),
        undefined,
        formData.alternateIp.trim() || undefined,
        { firmware: finalFlavor }
      );
      navigation.goBack();
    } catch (validationErrors: any) {
      console.warn('Erro ao guardar impressora:', validationErrors);
      const newErrors: FormErrors = {};
      if (validationErrors?.inner && Array.isArray(validationErrors.inner)) {
        validationErrors.inner.forEach((error: any) => {
          newErrors[error.path as keyof FormErrors] = error.message;
        });
      } else {
        Alert.alert(
          t('comum.erro'),
          validationErrors?.message || 'Falha ao validar os campos'
        );
      }
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

  const canSave =
    formData.printerName.length >= 2 && formData.ipAddress.length > 0;

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

        <View className="mt-5">
          <Text className="text-[12px] font-medium text-ink-soft mb-1.5">
            {t('addPrinter.ipAlternativo')}
          </Text>
          <TextInput
            className={fieldClass('alternateIp')}
            placeholder={t('addPrinter.ipAlternativoPlaceholder')}
            placeholderTextColor={hexDe(tema.paleta.tintaMuted)}
            value={formData.alternateIp}
            onChangeText={value => handleInputChange('alternateIp', value)}
            onFocus={() => setFocused('alternateIp')}
            onBlur={() => setFocused(null)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="numbers-and-punctuation"
            style={{ fontFamily: 'monospace' }}
          />
          <Text className="mt-1.5 text-[11px] text-ink-muted">
            {t('addPrinter.ipAlternativoDica')}
          </Text>
        </View>

        {/* Bloco 5: Seletor de Firmware */}
        <View className="mt-5 rounded-xl2 border border-line bg-cartao p-4">
          <Text className="text-[10px] tracking-widest font-semibold text-ink-soft mb-3">
            {t('addPrinter.firmware')}
          </Text>

          {[
            { id: 'auto', label: t('addPrinter.firmwareAuto') },
            { id: 'sdcp', label: t('addPrinter.firmwareSdcp') },
            { id: 'moonraker', label: t('addPrinter.firmwareMoonraker') },
          ].map(opt => (
            <TouchableOpacity
              key={opt.id}
              onPress={() =>
                setFormData(prev => ({
                  ...prev,
                  firmware: opt.id as any,
                }))
              }
              activeOpacity={0.7}
              className="flex-row items-center py-2.5"
              style={{ minHeight: 48 }}
            >
              <View className="h-5 w-5 rounded-full border border-line items-center justify-center mr-3 bg-fundo">
                {formData.firmware === opt.id && (
                  <View className="h-2.5 w-2.5 rounded-full bg-brand" />
                )}
              </View>
              <Text className="text-[13px] text-ink font-medium">
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bloco 6: Botão Testar Ligação */}
        <TouchableOpacity
          onPress={handleTestConnection}
          disabled={isTesting || !formData.ipAddress.trim()}
          activeOpacity={0.7}
          className="mt-4 rounded-xl border border-line bg-cartao py-3.5 items-center flex-row justify-center"
          style={{ minHeight: 48 }}
        >
          {isTesting ? (
            <>
              <ActivityIndicator
                size="small"
                color={hexDe(tema.paleta.acento)}
              />
              <Text className="ml-2 text-[14px] font-semibold text-ink-soft">
                {t('addPrinter.aTestar')}
              </Text>
            </>
          ) : (
            <Text className="text-[14px] font-semibold text-brand-texto">
              {t('addPrinter.testarLigacao')}
            </Text>
          )}
        </TouchableOpacity>

        {/* Bloco 7: Resultado do Teste */}
        {testResult && (
          <View
            className={`mt-3 rounded-xl p-3 border ${
              testResult.status === 'success'
                ? 'border-state-success/40 bg-state-success/10'
                : 'border-state-danger/40 bg-state-danger/10'
            }`}
          >
            <Text
              className={`text-[13px] font-semibold ${
                testResult.status === 'success'
                  ? 'text-state-success'
                  : 'text-state-danger'
              }`}
            >
              {testResult.msg}
            </Text>
            {testResult.details && (
              <Text className="mt-1 text-[11px] text-ink-muted">
                {testResult.details}
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!canSave || isSubmitting}
          activeOpacity={0.85}
          className={`mt-4 rounded-xl2 py-4 items-center ${
            canSave && !isSubmitting ? 'bg-brand' : 'bg-line opacity-50'
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
          <Ionicons
            name="wifi"
            size={16}
            color={hexDe(tema.paleta.tintaSoft)}
          />
          <Text className="ml-2 text-[13px] font-semibold text-ink-soft">
            {t('addPrinter.analisarRede')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};
