"use client";

// Country → State → City, each a type-to-search select. Values are saved as names ("India", "Haryana", "Gurugram").
//   <LocationFields control={control} errors={errors} idPrefix="emp" />
// Picking a country clears state and city; picking a state clears city. Unlisted names can still be typed.
import { useEffect, useMemo, useState } from "react";
import { useController, useWatch, type Control, type FieldError, type FieldPath, type FieldValues } from "react-hook-form";
import { FormField } from "./form-field";
import { SearchSelect } from "./search-select";
import type { FieldSpan } from "./form-layout";

type Geo = typeof import("country-state-city");
let geoCache: Geo | null = null;
let geoLoading: Promise<Geo> | null = null;

// The data is large, so it's fetched on first use and shared after that
function useGeo() {
  const [geo, setGeo] = useState<Geo | null>(geoCache);
  useEffect(() => {
    if (geoCache) return;
    let cancelled = false;
    geoLoading ??= import("country-state-city").then((m) => (geoCache = m));
    geoLoading.then((m) => !cancelled && setGeo(m));
    return () => {
      cancelled = true;
    };
  }, []);
  return geo;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function LocationFields<T extends FieldValues, C = unknown, R = T>({
  control,
  errors,
  idPrefix,
  names = { country: "country", state: "state", city: "city" } as { country: FieldPath<T>; state: FieldPath<T>; city: FieldPath<T> },
  required,
  span,
}: {
  control: Control<T, C, R>;
  errors?: Partial<Record<"country" | "state" | "city", FieldError | { message?: string }>>;
  idPrefix: string;
  names?: { country: FieldPath<T>; state: FieldPath<T>; city: FieldPath<T> };
  required?: boolean;
  span?: FieldSpan;
}) {
  const geo = useGeo();
  const country = useController({ control, name: names.country });
  const state = useController({ control, name: names.state });
  const city = useController({ control, name: names.city });
  const countryName = (useWatch({ control, name: names.country }) as string | undefined) ?? "";
  const stateName = (useWatch({ control, name: names.state }) as string | undefined) ?? "";

  const countries = useMemo(() => geo?.Country.getAllCountries() ?? [], [geo]);
  const iso = countries.find((c) => same(c.name, countryName))?.isoCode;
  const states = useMemo(() => (geo && iso ? geo.State.getStatesOfCountry(iso) : []), [geo, iso]);
  const stateIso = states.find((s) => same(s.name, stateName))?.isoCode;
  const cities = useMemo(() => (geo && iso && stateIso ? geo.City.getCitiesOfState(iso, stateIso) : []), [geo, iso, stateIso]);

  const opts = (list: { name: string }[]) => [...new Set(list.map((x) => x.name))].map((name) => ({ value: name, label: name }));

  return (
    <>
      <FormField label="Country" htmlFor={`${idPrefix}-country`} error={errors?.country} required={required} span={span}>
        <SearchSelect
          id={`${idPrefix}-country`}
          value={(country.field.value as string) ?? ""}
          onValueChange={(v) => {
            if (same(v, countryName)) return;
            country.field.onChange(v);
            state.field.onChange("");
            city.field.onChange("");
          }}
          options={opts(countries)}
          loading={!geo}
          invalid={Boolean(errors?.country)}
          allowCustom
        />
      </FormField>
      <FormField label="State" htmlFor={`${idPrefix}-state`} error={errors?.state} required={required} span={span}>
        <SearchSelect
          id={`${idPrefix}-state`}
          value={(state.field.value as string) ?? ""}
          onValueChange={(v) => {
            if (same(v, stateName)) return;
            state.field.onChange(v);
            city.field.onChange("");
          }}
          options={opts(states)}
          loading={!geo}
          invalid={Boolean(errors?.state)}
          allowCustom
        />
      </FormField>
      <FormField label="City" htmlFor={`${idPrefix}-city`} error={errors?.city} required={required} span={span}>
        <SearchSelect
          id={`${idPrefix}-city`}
          value={(city.field.value as string) ?? ""}
          onValueChange={city.field.onChange}
          options={opts(cities)}
          loading={!geo}
          invalid={Boolean(errors?.city)}
          allowCustom
        />
      </FormField>
    </>
  );
}
