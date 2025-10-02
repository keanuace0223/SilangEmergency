import { CustomInputProps } from "@/type";
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import ScaledText from './ScaledText';

const CustomInputs = ({
    placeholder = 'Enter Text', 
    value, 
    onChangeText, 
    label,
    secureTextEntry = false,
    keyboardType= "default"
}: CustomInputProps) => {

  const [isFocused, setIsFocused] = useState (false);

  return  (
    <View className="w-full gap-2">
        <ScaledText 
          baseSize={16}
          className="font-medium"
          style={{
            marginBottom: 5,
            color: "#4A90E2",
          }}
        >
          {label}
        </ScaledText>

        <TextInput 
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor={'#666'}
          placeholder={placeholder}
          style={{
            borderWidth: 2,
            borderColor: isFocused ? '#4A90E2' : '#D1D5DB',
            backgroundColor: 'white',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 8,
            color: '#111827',
            fontSize: 16
          }}
          className=""
        />
    </View>
  )
}

export default CustomInputs