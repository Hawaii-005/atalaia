import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Referência para navegar fora de um ecrã (por exemplo quando o Android
 * entrega um ficheiro ao arrancar a app, antes de haver um ecrã montado).
 */
export const navegacaoRef = createNavigationContainerRef<any>();
