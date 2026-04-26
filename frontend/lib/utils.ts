// Tailwind 클래스 병합 유틸리티 - 조건부 클래스 결합에 사용
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
