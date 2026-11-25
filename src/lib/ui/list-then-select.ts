import { flushSync } from "react-dom"

/**
 * Listeye yeni bir seçenek ekleyip hemen onu seçmek için (#884).
 *
 * Radix Select bir <form> içinde gizli bir native <select> basar; yeni
 * <option> bir render GEÇ kaydolur, ama gizli select'in efekti değeri önce
 * yazıp "change" yayar → native değer "" olur → onValueChange("") alanı
 * boşaltır. Seçeneği `flushSync` ile önce işleyip değeri sonra veririz.
 *
 * Yalnız olay işleyicisinden / await sonrasından çağır; render ya da efekt
 * içinden ASLA (flushSync orada hata verir).
 */
export function listThenSelect(addOption: () => void, select: () => void): void {
  flushSync(addOption)
  select()
}
