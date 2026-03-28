import { getMonthStart, getMonthEnd } from "@/src/lib/formatters";

// ============================================================================
// STATE TYPES
// ============================================================================

export type DataState = {
  loading: boolean;
  error: string | null;
  receipts: any[];
  customers: any[];
  tyres: any[];
};

export type FiltersState = {
  searchText: string;
  customerFilter: string[];
  paymentTypeFilter: string[];
  regionFilter: string[];
  salespersonFilter: string[];
  dateStart: string;
  dateEnd: string;
  expandedReceiptIds: number[];
};

export type AllReceiptsState = {
  data: DataState;
  filters: FiltersState;
};

// ============================================================================
// INITIAL STATE
// ============================================================================

export const initialDataState: DataState = {
  loading: true,
  error: null,
  receipts: [],
  customers: [],
  tyres: [],
};

export const initialFiltersState: FiltersState = {
  searchText: "",
  customerFilter: [],
  paymentTypeFilter: [],
  regionFilter: [],
  salespersonFilter: [],
  dateStart: getMonthStart(),
  dateEnd: getMonthEnd(),
  expandedReceiptIds: [],
};

export const initialState: AllReceiptsState = {
  data: initialDataState,
  filters: initialFiltersState,
};

// ============================================================================
// ACTIONS
// ============================================================================

export type DataAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | {
      type: "SET_DATA";
      payload: {
        receipts: any[];
        customers: any[];
        tyres: any[];
      };
    };

export type FiltersAction =
  | { type: "SET_SEARCH_TEXT"; payload: string }
  | { type: "SET_CUSTOMER_FILTER"; payload: string[] }
  | { type: "SET_PAYMENT_TYPE_FILTER"; payload: string[] }
  | { type: "SET_REGION_FILTER"; payload: string[] }
  | { type: "SET_SALESPERSON_FILTER"; payload: string[] }
  | { type: "SET_DATE_START"; payload: string }
  | { type: "SET_DATE_END"; payload: string }
  | { type: "TOGGLE_EXPANDED"; payload: number }
  | { type: "RESET_FILTERS" };

export type AllReceiptsAction = DataAction | FiltersAction;

// ============================================================================
// REDUCERS
// ============================================================================

export function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };

    case "SET_ERROR":
      return { ...state, error: action.payload };

    case "SET_DATA":
      return {
        ...state,
        loading: false,
        error: null,
        receipts: action.payload.receipts,
        customers: action.payload.customers,
        tyres: action.payload.tyres,
      };

    default:
      return state;
  }
}

export function filtersReducer(
  state: FiltersState,
  action: FiltersAction
): FiltersState {
  switch (action.type) {
    case "SET_SEARCH_TEXT":
      return { ...state, searchText: action.payload };

    case "SET_CUSTOMER_FILTER":
      return { ...state, customerFilter: action.payload };

    case "SET_PAYMENT_TYPE_FILTER":
      return { ...state, paymentTypeFilter: action.payload };

    case "SET_REGION_FILTER":
      return { ...state, regionFilter: action.payload };

    case "SET_SALESPERSON_FILTER":
      return { ...state, salespersonFilter: action.payload };

    case "SET_DATE_START":
      return { ...state, dateStart: action.payload };

    case "SET_DATE_END":
      return { ...state, dateEnd: action.payload };

    case "TOGGLE_EXPANDED": {
      const id = action.payload;
      return {
        ...state,
        expandedReceiptIds: state.expandedReceiptIds.includes(id)
          ? state.expandedReceiptIds.filter((rid) => rid !== id)
          : [...state.expandedReceiptIds, id],
      };
    }

    case "RESET_FILTERS":
      return {
        ...initialFiltersState,
        dateStart: getMonthStart(),
        dateEnd: getMonthEnd(),
      };

    default:
      return state;
  }
}

export function rootReducer(
  state: AllReceiptsState,
  action: AllReceiptsAction
): AllReceiptsState {
  return {
    data: dataReducer(state.data, action as DataAction),
    filters: filtersReducer(state.filters, action as FiltersAction),
  };
}
