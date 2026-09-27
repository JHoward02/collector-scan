import type { Category, CategoryFilter, SearchStatus } from "./types.ts";
import type { ScoredCandidate } from "./match.ts";

export type Tab = "search" | "collection";
export type SortKey = "recent" | "title" | "value" | "category";
export type GroupFilter = string;
export type TcgGame = "magic" | "yugioh" | "pokemon" | "lorcana" | "one-piece" | "fab" | "other";
export type FigureLine = "amiibo" | "mcfarlane" | "funko-pop" | "nendoroid" | "other";

export interface AppSession {
  activeTab: Tab;
  query: string;
  searchCategory: Category | null;
  tcgGame: TcgGame | null;
  figureLine: FigureLine | null;
  categoryFilter: CategoryFilter;
  status: SearchStatus;
  results: ScoredCandidate[];
  warnings: string[];
  error: string | null;
  resultsFor: string;
  resultTokens: number;
  collectionQuery: string;
  collectionFilter: CategoryFilter;
  collectionSort: SortKey;
  collectionGroupFilter: GroupFilter;
  groupFormOpen: boolean;
  favoritesOnly: boolean;
  flash: string | null;
}

export function createSession(): AppSession {
  return {activeTab:"search",query:"",searchCategory:null,tcgGame:null,figureLine:null,categoryFilter:"all",status:"idle",results:[],warnings:[],error:null,resultsFor:"",resultTokens:0,collectionQuery:"",collectionFilter:"all",collectionSort:"recent",collectionGroupFilter:"all",groupFormOpen:false,favoritesOnly:false,flash:null};
}
export function clearSession(session:AppSession):void{session.activeTab="search";session.query="";session.searchCategory=null;session.tcgGame=null;session.figureLine=null;session.categoryFilter="all";session.status="idle";session.results=[];session.warnings=[];session.error=null;session.resultsFor="";session.resultTokens=0;session.collectionQuery="";session.collectionFilter="all";session.collectionSort="recent";session.collectionGroupFilter="all";session.groupFormOpen=false;session.favoritesOnly=false;session.flash=null;}
