

export interface CustomInputProps {
    placeholder?: string,
    value?: string,
    onChangeText?: (text: string) => void;
    label: string,
    secureTextEntry?: boolean;
    keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}

// Module shims for Expo packages where types may not be resolved in Metro/TS
declare module 'expo-image-manipulator' {
    export const SaveFormat: { JPEG: 'jpeg'; PNG: 'png'; WEBP: 'webp' }
    export function manipulateAsync(
        uri: string,
        actions: any[],
        options?: { compress?: number; format?: 'jpeg' | 'png' | 'webp'; base64?: boolean }
    ): Promise<{ uri: string; width: number; height: number; base64?: string }>
}