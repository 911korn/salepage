"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" size="md" onClick={() => window.print()}>
      <Printer className="size-4" /> พิมพ์
    </Button>
  );
}
