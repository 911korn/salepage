import { View, Text } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/ui/screen";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-[36px] font-bold text-brand-700">404</Text>
        <Text className="mt-2 text-center text-[15px] text-muted">
          ไม่พบหน้าที่คุณกำลังหา
        </Text>
        <Button className="mt-6" onPress={() => router.replace("/")}>
          กลับหน้าหลัก
        </Button>
      </View>
    </Screen>
  );
}
