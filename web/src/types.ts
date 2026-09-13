export interface DailyForecast {
  date: string;
  minTemperature: number;
  maxTemperature: number;
  precipitation: number;
}

export interface CityWeather {
  city: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  forecast: DailyForecast[];
}

export interface ReportSource {
  id: string;
  label: string;
  load: () => Promise<unknown>;
}
