import React, { useState, useEffect } from 'react';
import { Image, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';

interface DynamicImageProps {
    uri: string;
    style?: any;
    contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    transition?: number;
    onError?: (error: any) => void;
}

export const DynamicImage = ({ uri, style, contentFit = 'cover', transition = 300, onError }: DynamicImageProps) => {
    const [aspectRatio, setAspectRatio] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    // Sosyal medya standartı (Instagram dikey post oranı 4:5 = 0.8)
    const MIN_ASPECT_RATIO = 0.8;
    const finalAspectRatio = aspectRatio ? Math.max(aspectRatio, MIN_ASPECT_RATIO) : 0.8;
    
    // Uzun görsellerin kırpılmaması için 'contain' kullanıyoruz
    const finalContentFit = (aspectRatio && aspectRatio < MIN_ASPECT_RATIO) ? 'contain' : contentFit;

    useEffect(() => {
        if (uri) {
            Image.getSize(uri, (w, h) => {
                setAspectRatio(w / h);
                setLoading(false);
            }, (err) => {
                console.log("DynamicImage Error:", err);
                setLoading(false);
                if (onError) onError(err);
            });
        }
    }, [uri]);

    if (!uri) return null;

    return (
        <View style={[style, { aspectRatio: finalAspectRatio, height: undefined, backgroundColor: '#1a1a1a' }]}>
            <ExpoImage
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit={finalContentFit}
                transition={transition}
            />
            {loading && !aspectRatio && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <ActivityIndicator size="small" color="#800020" />
                </View>
            )}
        </View>
    );
};
