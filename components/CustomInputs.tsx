import { CustomInputProps } from "@/type";
import React, { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

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
        <Text className="text-gray-700 font-medium text-base" style={{

          marginBottom: 5,
          color: "#4A90E2",
        }}>{label}</Text>

        <TextInput 
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#666"
          placeholder={placeholder}
          style={{
            borderWidth: 2,
            borderColor: isFocused ? '#4A90E2' : '#D1D5DB',
            backgroundColor: 'white',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 8,
          }}
          className="text-base"
        />
    </View>
  )
}

export default CustomInputs