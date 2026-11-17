import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DATA from './catalogo-mercato.json';

const PHOTO = {
  bra_grey: require('../../assets/catalogo-mercato-miniature/bra-grey.jpg'),
  bra_black: require('../../assets/catalogo-mercato-miniature/bra-black.jpg'),
  bra_seamless: require('../../assets/catalogo-mercato-miniature/bra-seamless.jpg'),
  bra_display: require('../../assets/catalogo-mercato-miniature/bra-display.jpg'),
  panties_brown: require('../../assets/catalogo-mercato-miniature/panties-brown.jpg'),
  garter: require('../../assets/catalogo-mercato-miniature/garter-belt.jpg'),
  corset: require('../../assets/catalogo-mercato-miniature/corset-historic.jpg'),
  corset_red: require('../../assets/catalogo-mercato-miniature/corset-red.jpg'),
  stockings: require('../../assets/catalogo-mercato-miniature/stockings-met.jpg'),
};
const C={dark:'#21121B',plum:'#3D1B2D',gold:'#C9A66B',light:'#E7D4AC',cream:'#FBF6F2',white:'#FFFDFC',muted:'#8B777E',line:'#EADFE0',red:'#9B4C50'};
const categories=['Tutte',...new Set(DATA.products.map(p=>p.category))];
const euro=n=>Number(n).toLocaleString('it-IT',{style:'currency',currency:'EUR'});

export default function MarketCatalog(){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('Tutte');
 const [brand,setBrand]=useState('Tutti');
 const [visibleCount,setVisibleCount]=useState(8);
 const brands=['Tutti',...new Set(DATA.products.map(p=>p.brand))];
 const list=useMemo(()=>DATA.products.filter(p=>(category==='Tutte'||p.category===category)&&(brand==='Tutti'||p.brand===brand)&&`${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(query.trim().toLowerCase())),[query,category,brand]);
 useEffect(()=>{setVisibleCount(8);},[query,category,brand]);
 const visibleList=list.slice(0,visibleCount);
 return <ScrollView style={s.root} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
  <Text style={s.eyebrow}>ARCHIVIO PRIVATO · CONFRONTO PREZZI</Text>
  <Text style={s.title}>Catalogo di mercato</Text>
  <Text style={s.description}>{DATA.count} modelli rilevati sui listini ufficiali al {new Date(DATA.checkedAt+'T12:00:00').toLocaleDateString('it-IT')}. Sono referenze di marchi terzi, non articoli SabryFox.</Text>
  <View style={s.notice}><Text style={s.noticeTitle}>SOLO RIFERIMENTI — NON VENDIBILI</Text><Text style={s.noticeText}>Prezzi e modelli sono quelli pubblicati dai marchi indicati. Scorte impostate a zero. Taglie, colori, promozioni e disponibilità vanno ricontrollati sul sito ufficiale. Le foto sono immagini CC0 rappresentative della categoria, non foto del singolo prodotto.</Text></View>
  <TextInput value={query} onChangeText={setQuery} placeholder="Cerca modello, tipo o marchio" placeholderTextColor={C.muted} style={s.search}/>
  <Text style={s.filterLabel}>MARCHIO</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{brands.map(b=><Pressable key={b} onPress={()=>setBrand(b)} style={[s.chip,brand===b&&s.chipActive]}><Text style={[s.chipText,brand===b&&s.chipTextActive]}>{b}</Text></Pressable>)}</ScrollView>
  <Text style={s.filterLabel}>CATEGORIA</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>{categories.map(c=><Pressable key={c} onPress={()=>setCategory(c)} style={[s.chip,category===c&&s.chipActive]}><Text style={[s.chipText,category===c&&s.chipTextActive]}>{c}</Text></Pressable>)}</ScrollView>
  <Text style={s.count}>{list.length} MODELLI</Text>
  {visibleList.map(p=><View key={p.id} style={s.card}>
    <Image source={PHOTO[p.photoKey]} style={s.photo} resizeMode="contain"/>
    <View style={s.cardBody}>
      <Text style={s.brand}>{p.brand.toUpperCase()} · {p.category.toUpperCase()}</Text>
      <Text style={s.name}>{p.name}</Text>
      <Text style={s.price}>{euro(p.priceEUR)}</Text>
      <Text style={s.variant}>Taglie e colori: da verificare sul listino ufficiale.</Text>
      <Text style={s.stock}>GIACENZA INTERNA: 0 · NON IN VENDITA</Text>
      <Pressable onPress={()=>Linking.openURL(p.sourceUrl)} style={s.link}><Text style={s.linkText}>CONSULTA IL LISTINO UFFICIALE ↗</Text></Pressable>
    </View>
  </View>)}
  {visibleList.length < list.length ? (
    <Pressable
      onPress={()=>setVisibleCount(n=>Math.min(n+8,list.length))}
      style={{marginVertical:14,backgroundColor:C.plum,padding:15,borderRadius:12,alignItems:'center'}}
    >
      <Text style={{color:'#F5DFAE',fontWeight:'900',fontSize:14}}>
        MOSTRA ALTRI PRODOTTI ({list.length-visibleList.length})
      </Text>
    </Pressable>
  ) : null}
  <Text style={s.footer}>Archivio interno SabryFox2025 · Rilevazione prezzi {DATA.checkedAt}. Non affiliato ai marchi citati.</Text>
 </ScrollView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:C.cream},content:{padding:13,paddingBottom:22},eyebrow:{color:'#9A7440',fontSize:8,fontWeight:'800',letterSpacing:1.4},title:{fontFamily:'Georgia',fontSize:25,color:C.dark,marginTop:5},description:{fontSize:10,lineHeight:16,color:C.muted,marginTop:6},notice:{borderWidth:1,borderColor:'#DCC79F',backgroundColor:'#F5EBDD',borderRadius:12,padding:11,marginTop:12},noticeTitle:{fontSize:9,fontWeight:'900',letterSpacing:1,color:'#73552F'},noticeText:{fontSize:9,lineHeight:14,color:'#705B4A',marginTop:5},search:{marginTop:13,backgroundColor:C.white,borderColor:C.line,borderWidth:1,borderRadius:10,paddingHorizontal:12,paddingVertical:10,color:C.dark,fontSize:11},filterLabel:{fontSize:8,fontWeight:'800',letterSpacing:1,color:'#895F38',marginTop:13,marginBottom:6},chips:{gap:7,paddingBottom:2},chip:{borderWidth:1,borderColor:'#DDC9CB',borderRadius:18,paddingVertical:7,paddingHorizontal:10,backgroundColor:C.white},chipActive:{backgroundColor:C.plum,borderColor:C.plum},chipText:{color:C.plum,fontSize:9,fontWeight:'700'},chipTextActive:{color:C.light},count:{fontSize:8,color:C.muted,fontWeight:'800',letterSpacing:1.3,marginTop:13,marginBottom:8},card:{backgroundColor:C.white,borderRadius:13,borderWidth:1,borderColor:C.line,marginBottom:10,overflow:'hidden'},photo:{width:'100%',height:150,backgroundColor:'#F1E8DF'},cardBody:{padding:11},brand:{color:'#987240',fontSize:8,letterSpacing:1,fontWeight:'900'},name:{color:C.dark,fontFamily:'Georgia',fontSize:15,marginTop:5},price:{color:C.plum,fontSize:16,fontWeight:'900',marginTop:6},variant:{color:C.muted,fontSize:9,marginTop:5},stock:{color:C.red,fontSize:8,fontWeight:'900',letterSpacing:.6,marginTop:6},link:{marginTop:9,alignSelf:'flex-start',paddingVertical:7,paddingHorizontal:9,borderRadius:14,borderWidth:1,borderColor:C.gold},linkText:{color:C.plum,fontSize:8,fontWeight:'900',letterSpacing:.6},footer:{color:C.muted,fontSize:8,textAlign:'center',marginTop:15,lineHeight:13}});
