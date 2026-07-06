import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './CreateConcept.css';
import { ConceptSidebarNews } from '../components/ConceptSidebarNews';

import logoImg from '../assets/logo.png';
import { API_URL } from '../config';
import NavProfileButton from '../components/NavProfileButton';
import NotificationBell from '../components/NotificationBell';

/* ============================================================
   COLOR & FONT CONSTANTS  (ported from CreateConcept_News.jsx)
   ============================================================ */

const CNCPT_COLOR_CATS = {
  tone: {
    label:'โทนสี', icon:'mdi:palette-outline', all:'ทุกโทนสี',
    items:[
      {value:'อบอุ่น',en:'Warm'},{value:'เย็น',en:'Cool'},
      {value:'เป็นกลาง',en:'Neutral'},{value:'สดใส',en:'Vibrant'},
      {value:'พาสเทล',en:'Pastel'},{value:'เข้ม',en:'Dark'},
    ],
  },
  mood: {
    label:'อารมณ์แบรนด์', icon:'mdi:emoticon-outline', all:'ทุกอารมณ์',
    items:[
      {value:'เป็นกันเอง',en:'Friendly'},{value:'มืออาชีพ',en:'Professional'},
      {value:'สนุกสนาน',en:'Playful'},{value:'หรูหรา',en:'Elegant'},{value:'โดดเด่น',en:'Bold'},
    ],
  },
  biz: {
    label:'ประเภทธุรกิจ', icon:'mdi:briefcase-outline', all:'ทุกประเภทธุรกิจ',
    items:[
      {value:'อาหาร / ของกินเล่น'},{value:'เครื่องดื่ม'},
      {value:'เสื้อผ้า'},{value:'ความงาม'},{value:'เทคโนโลยี'},
    ],
  },
};

const CNCPT_TONE_TH2EN       = Object.fromEntries(CNCPT_COLOR_CATS.tone.items.map(i=>[i.value,i.en]));
const CNCPT_MOOD_TH2EN_COLOR = Object.fromEntries(CNCPT_COLOR_CATS.mood.items.map(i=>[i.value,i.en]));
const CNCPT_EN2TH_MOOD       = Object.fromEntries(CNCPT_COLOR_CATS.mood.items.map(i=>[i.en,i.value]));
const CNCPT_EN2TH_TONE       = Object.fromEntries(CNCPT_COLOR_CATS.tone.items.map(i=>[i.en,i.value]));

const CNCPT_PALETTE_LIBRARY = [
  /* ── Friendly ── */
  {name:'Sunny Warmth',      mood:'Friendly', tones:['Warm','Vibrant'],  biz:'อาหาร / ของกินเล่น', colors:['#FF6B35','#F7C59F','#EFEFD0','#004E89','#1A936F']},
  {name:'Peach Garden',      mood:'Friendly', tones:['Warm','Pastel'],   biz:'ความงาม',             colors:['#FFADAD','#FFD6A5','#FDFFB6','#CAFFBF','#9BF6FF']},
  {name:'Cheerful Bloom',    mood:'Friendly', tones:['Vibrant'],         biz:'อาหาร / ของกินเล่น', colors:['#FF595E','#FFCA3A','#6A4C93','#1982C4','#8AC926']},
  {name:'Fresh Mint',        mood:'Friendly', tones:['Cool','Pastel'],   biz:'เครื่องดื่ม',         colors:['#06D6A0','#118AB2','#073B4C','#FFD166','#EF476F']},
  {name:'Warm Cocoa',        mood:'Friendly', tones:['Warm','Neutral'],  biz:'เครื่องดื่ม',         colors:['#D4A373','#FAEDCD','#FEFAE0','#E9EDC9','#CCD5AE']},
  {name:'Honey Glow',        mood:'Friendly', tones:['Warm'],            biz:'อาหาร / ของกินเล่น', colors:['#FFB703','#FB8500','#023047','#219EBC','#8ECAE6']},
  {name:'Soft Breeze',       mood:'Friendly', tones:['Pastel','Cool'],   biz:'ความงาม',             colors:['#B8E0D2','#D6EADF','#EAC4D5','#95B8D1','#E8DDB5']},
  {name:'Spring Field',      mood:'Friendly', tones:['Vibrant','Warm'],  biz:'เสื้อผ้า',            colors:['#80B918','#55A630','#AACC00','#BFD200','#D4D700']},
  {name:'Cozy Café',         mood:'Friendly', tones:['Warm','Dark'],     biz:'เครื่องดื่ม',         colors:['#6F4E37','#A0785A','#D4A373','#E6CCB2','#FEFAE0']},
  {name:'Garden Party',      mood:'Friendly', tones:['Pastel'],          biz:'อาหาร / ของกินเล่น', colors:['#FEC5BB','#FCD5CE','#FAE1DD','#F8EDEB','#E8E8E4']},
  {name:'Coral Reef',        mood:'Friendly', tones:['Warm','Vibrant'],  biz:'เทคโนโลยี',          colors:['#FF6F61','#FFB5A7','#FCD5CE','#F8EDEB','#F9DCC4']},
  {name:'Citrus Pop',        mood:'Friendly', tones:['Vibrant'],         biz:'เครื่องดื่ม',         colors:['#FF9F1C','#FFBF69','#CBF3F0','#2EC4B6','#FFFFFF']},
  {name:'Vanilla Sky',       mood:'Friendly', tones:['Pastel','Neutral'],biz:'ความงาม',             colors:['#F0EFEB','#DFE0DF','#B8BDB5','#DDBEA9','#FFE8D6']},
  {name:'Lemon Fizz',        mood:'Friendly', tones:['Vibrant','Warm'],  biz:'เครื่องดื่ม',         colors:['#FFE66D','#FF6B6B','#4ECDC4','#1A535C','#F7FFF7']},
  {name:'Sunset Terrace',    mood:'Friendly', tones:['Warm'],            biz:'อาหาร / ของกินเล่น', colors:['#F4845F','#F79D65','#F7B267','#F7D08A','#F9E7C0']},
  {name:'Friendly Tech',     mood:'Friendly', tones:['Cool'],            biz:'เทคโนโลยี',          colors:['#48CAE4','#90E0EF','#ADE8F4','#CAF0F8','#023E8A']},
  /* Friendly gaps */
  {name:'Cool Bites',        mood:'Friendly', tones:['Cool'],             biz:'อาหาร / ของกินเล่น', colors:['#48CAE4','#90E0EF','#ADE8F4','#FFD166','#F4845F']},
  {name:'Cool Threads',      mood:'Friendly', tones:['Cool','Pastel'],    biz:'เสื้อผ้า',            colors:['#5FA8D3','#62B6CB','#BEE9E8','#CAE9FF','#F0F3BD']},
  {name:'Earthy Snack',      mood:'Friendly', tones:['Neutral'],          biz:'อาหาร / ของกินเล่น', colors:['#CCD5AE','#E9EDC9','#FEFAE0','#FAEDCD','#D4A373']},
  {name:'Warm Neutral Wear', mood:'Friendly', tones:['Neutral','Warm'],   biz:'เสื้อผ้า',            colors:['#B7B7A4','#A5A58D','#6B705C','#FFE8D6','#DDBEA9']},
  {name:'Soft Code',         mood:'Friendly', tones:['Neutral'],          biz:'เทคโนโลยี',          colors:['#CED4DA','#ADB5BD','#6C757D','#495057','#F8F9FA']},
  {name:'Vivid Bloom',       mood:'Friendly', tones:['Vibrant'],          biz:'ความงาม',             colors:['#FF6B6B','#FEC89A','#FFD6FF','#E7C6FF','#C8B6FF']},
  {name:'Pastel Linen',      mood:'Friendly', tones:['Pastel'],           biz:'เสื้อผ้า',            colors:['#FEC5BB','#FCD5CE','#F8EDEB','#E8E8E4','#D6CCC2']},
  {name:'Soft Signal',       mood:'Friendly', tones:['Pastel'],           biz:'เทคโนโลยี',          colors:['#BDE0FE','#A2D2FF','#CDB4DB','#FFC8DD','#FFAFCC']},
  {name:'Roast Friendly',    mood:'Friendly', tones:['Dark','Warm'],      biz:'อาหาร / ของกินเล่น', colors:['#5C4033','#8B6914','#C4A35A','#E6CCB2','#FFF1E6']},
  {name:'Denim Dusk',        mood:'Friendly', tones:['Dark'],             biz:'เสื้อผ้า',            colors:['#1B264F','#274C77','#6096BA','#A3CEF1','#E7ECEF']},
  {name:'Cozy Glow',         mood:'Friendly', tones:['Dark','Warm'],      biz:'ความงาม',             colors:['#3C2415','#774936','#BB8A52','#E6C9A8','#FFF1E6']},
  {name:'Dark Friendly UI',  mood:'Friendly', tones:['Dark','Cool'],      biz:'เทคโนโลยี',          colors:['#1B2838','#2A4158','#457B9D','#A8DADC','#F1FAEE']},
  /* ── Professional ── */
  {name:'Corporate Slate',   mood:'Professional', tones:['Cool','Dark'],     biz:'เทคโนโลยี',   colors:['#2C3E50','#34495E','#3498DB','#ECF0F1','#BDC3C7']},
  {name:'Clean Logic',       mood:'Professional', tones:['Neutral','Cool'],  biz:'เทคโนโลยี',   colors:['#0D1B2A','#1B2838','#415A77','#778DA9','#E0E1DD']},
  {name:'Executive Navy',    mood:'Professional', tones:['Dark','Cool'],     biz:'เสื้อผ้า',     colors:['#03045E','#023E8A','#0077B6','#90E0EF','#CAF0F8']},
  {name:'Ocean Breeze',      mood:'Professional', tones:['Cool'],            biz:'เทคโนโลยี',   colors:['#005F73','#0A9396','#94D2BD','#E9D8A6','#EE9B00']},
  {name:'Steel Trust',       mood:'Professional', tones:['Neutral','Dark'],  biz:'เทคโนโลยี',   colors:['#212529','#343A40','#495057','#ADB5BD','#DEE2E6']},
  {name:'Blue Horizon',      mood:'Professional', tones:['Cool'],            biz:'เครื่องดื่ม',  colors:['#1D3557','#457B9D','#A8DADC','#F1FAEE','#E63946']},
  {name:'Crisp Document',    mood:'Professional', tones:['Neutral'],         biz:'เทคโนโลยี',   colors:['#F8F9FA','#E9ECEF','#DEE2E6','#6C757D','#212529']},
  {name:'Maritime',          mood:'Professional', tones:['Cool','Dark'],     biz:'เสื้อผ้า',     colors:['#001524','#15616D','#FFECD1','#FF7D00','#78290F']},
  {name:'Boardroom',         mood:'Professional', tones:['Neutral','Warm'],  biz:'เสื้อผ้า',     colors:['#3D405B','#81B29A','#F2CC8F','#E07A5F','#F4F1DE']},
  {name:'Clinic White',      mood:'Professional', tones:['Cool','Pastel'],   biz:'ความงาม',      colors:['#F0F4F8','#D9E2EC','#BCCCDC','#9FB3C8','#627D98']},
  {name:'Legal Ink',         mood:'Professional', tones:['Dark'],            biz:'เทคโนโลยี',   colors:['#0B132B','#1C2541','#3A506B','#5BC0BE','#6FFFE9']},
  {name:'Pro Beige',         mood:'Professional', tones:['Neutral','Warm'],  biz:'อาหาร / ของกินเล่น', colors:['#606C38','#283618','#FEFAE0','#DDA15E','#BC6C25']},
  {name:'Sky Office',        mood:'Professional', tones:['Cool','Pastel'],   biz:'เทคโนโลยี',   colors:['#A2D2FF','#BDE0FE','#FFAFCC','#FFC8DD','#CDB4DB']},
  /* Professional gaps */
  {name:'Warm Brew Pro',     mood:'Professional', tones:['Warm','Neutral'],  biz:'เครื่องดื่ม',  colors:['#606C38','#7F5539','#DDA15E','#FEFAE0','#283618']},
  {name:'Pro Beauty Warm',   mood:'Professional', tones:['Warm'],            biz:'ความงาม',      colors:['#C9ADA7','#9A8C98','#4A4E69','#22223B','#F2E9E4']},
  {name:'Warm Engine',       mood:'Professional', tones:['Warm','Neutral'],  biz:'เทคโนโลยี',   colors:['#BC6C25','#DDA15E','#FEFAE0','#606C38','#283618']},
  {name:'Pro Fresh',         mood:'Professional', tones:['Cool'],            biz:'อาหาร / ของกินเล่น', colors:['#003049','#669BBC','#C1D5E0','#FDF0D5','#C1121F']},
  {name:'Neutral Sip',       mood:'Professional', tones:['Neutral'],         biz:'เครื่องดื่ม',  colors:['#585858','#7D7D7D','#A8A8A8','#D4D4D4','#F5F5F5']},
  {name:'Pro Beauty Calm',   mood:'Professional', tones:['Neutral'],         biz:'ความงาม',      colors:['#E8E8E4','#D5BDAF','#D6CCC2','#F5EBE0','#EDEDE9']},
  {name:'Dark Pantry',       mood:'Professional', tones:['Dark'],            biz:'อาหาร / ของกินเล่น', colors:['#1B1B1B','#2D2D2D','#6B4226','#C68B59','#F5E6CC']},
  {name:'Dark Cellar',       mood:'Professional', tones:['Dark'],            biz:'เครื่องดื่ม',  colors:['#0B0C10','#1F2833','#45A29E','#66FCF1','#C5C6C7']},
  {name:'Dark Vanity',       mood:'Professional', tones:['Dark','Cool'],     biz:'ความงาม',      colors:['#1A1A2E','#16213E','#533483','#E94560','#F1C0E8']},
  /* ── Playful ── */
  {name:'Cotton Candy',      mood:'Playful', tones:['Pastel'],             biz:'ความงาม',             colors:['#FFAFCC','#BDE0FE','#A2D2FF','#CDB4DB','#FEFAE0']},
  {name:'Neon Pop',          mood:'Playful', tones:['Vibrant'],            biz:'เสื้อผ้า',            colors:['#FF006E','#FB5607','#FFBE0B','#8338EC','#3A86FF']},
  {name:'Tropical Burst',    mood:'Playful', tones:['Warm','Vibrant'],     biz:'เครื่องดื่ม',         colors:['#FDCB6E','#E17055','#74B9FF','#A29BFE','#55EFC4']},
  {name:'Sunset Glow',       mood:'Playful', tones:['Warm'],               biz:'อาหาร / ของกินเล่น', colors:['#FF4D6D','#FF6B6B','#FFA07A','#FFD700','#98FB98']},
  {name:'Candy Store',       mood:'Playful', tones:['Vibrant','Pastel'],   biz:'อาหาร / ของกินเล่น', colors:['#FF99C8','#FCF6BD','#D0F4DE','#A9DEF9','#E4C1F9']},
  {name:'Bubble Gum',        mood:'Playful', tones:['Pastel','Warm'],      biz:'ความงาม',             colors:['#F7AEF8','#B388EB','#8093F1','#72DDF7','#F7F7F7']},
  {name:'Fiesta',            mood:'Playful', tones:['Vibrant','Warm'],     biz:'อาหาร / ของกินเล่น', colors:['#FF1654','#247BA0','#70C1B3','#B2DBBF','#F3FFBD']},
  {name:'Rainbow Sprinkle',  mood:'Playful', tones:['Vibrant'],            biz:'อาหาร / ของกินเล่น', colors:['#9B5DE5','#F15BB5','#FEE440','#00BBF9','#00F5D4']},
  {name:'Jelly Bean',        mood:'Playful', tones:['Vibrant','Pastel'],   biz:'เสื้อผ้า',            colors:['#FF595E','#FF924C','#FFCA3A','#C5CA30','#8AC926']},
  {name:'Electric Dream',    mood:'Playful', tones:['Vibrant','Dark'],     biz:'เทคโนโลยี',          colors:['#7400B8','#6930C3','#5E60CE','#5390D9','#4EA8DE']},
  {name:'Tropical Juice',    mood:'Playful', tones:['Vibrant','Warm'],     biz:'เครื่องดื่ม',         colors:['#FF6D00','#FF9E00','#FFBD00','#E4FF1A','#76FF03']},
  {name:'Splash Zone',       mood:'Playful', tones:['Cool','Vibrant'],     biz:'เครื่องดื่ม',         colors:['#00B4D8','#0077B6','#03045E','#90E0EF','#CAF0F8']},
  /* Playful gaps */
  {name:'Cool Treat',        mood:'Playful', tones:['Cool'],              biz:'อาหาร / ของกินเล่น', colors:['#48CAE4','#00B4D8','#0096C7','#FFD166','#EF476F']},
  {name:'Neutral Snack',     mood:'Playful', tones:['Neutral','Warm'],    biz:'อาหาร / ของกินเล่น', colors:['#E8E8E4','#D6CCC2','#F5EBE0','#FFB703','#FB8500']},
  {name:'Neutral Fizz',      mood:'Playful', tones:['Neutral'],           biz:'เครื่องดื่ม',         colors:['#D4D4D4','#E8E8E4','#BFBFBF','#FF6B6B','#4ECDC4']},
  {name:'Dark Candy',        mood:'Playful', tones:['Dark','Vibrant'],    biz:'อาหาร / ของกินเล่น', colors:['#2B0B3F','#6B2FA0','#FF2281','#FF6D28','#FFBC42']},
  {name:'Dark Cola',         mood:'Playful', tones:['Dark'],              biz:'เครื่องดื่ม',         colors:['#1A0633','#3D1C6E','#822FAF','#D63AF9','#F0A6CA']},
  {name:'Pastel Soda',       mood:'Playful', tones:['Pastel'],            biz:'เครื่องดื่ม',         colors:['#FDFFB6','#CAFFBF','#9BF6FF','#A0C4FF','#FFC6FF']},
  {name:'Vibrant Beauty Fun',mood:'Playful', tones:['Vibrant'],           biz:'ความงาม',             colors:['#FF006E','#8338EC','#FFBE0B','#FB5607','#3A86FF']},
  /* ── Elegant ── */
  {name:'Velvet Rose',       mood:'Elegant', tones:['Dark','Warm'],       biz:'ความงาม',    colors:['#2D0320','#892B64','#C77DFF','#E0AAFF','#F8EDEB']},
  {name:'Midnight Gold',     mood:'Elegant', tones:['Dark'],              biz:'เสื้อผ้า',   colors:['#1A1A2E','#16213E','#0F3460','#E94560','#F5A623']},
  {name:'Lavender Dusk',     mood:'Elegant', tones:['Pastel','Cool'],     biz:'ความงาม',    colors:['#6C5CE7','#A29BFE','#DFE6E9','#B2BEC3','#FD79A8']},
  {name:'Rose Gold',         mood:'Elegant', tones:['Warm','Pastel'],     biz:'ความงาม',    colors:['#B76E79','#DDB3B3','#F2D0D0','#FAF0E6','#C2A06E']},
  {name:'Black Tie',         mood:'Elegant', tones:['Dark','Neutral'],    biz:'เสื้อผ้า',   colors:['#000000','#14213D','#FCA311','#E5E5E5','#FFFFFF']},
  {name:'Champagne Room',    mood:'Elegant', tones:['Warm','Neutral'],    biz:'เครื่องดื่ม',colors:['#DAA520','#CFB53B','#C5B358','#F5F5DC','#FFFFF0']},
  {name:'Royal Purple',      mood:'Elegant', tones:['Dark','Cool'],       biz:'ความงาม',    colors:['#10002B','#240046','#3C096C','#5A189A','#9D4EDD']},
  {name:'Silk Noir',         mood:'Elegant', tones:['Dark'],              biz:'เสื้อผ้า',   colors:['#0D0D0D','#1A1A1A','#333333','#8B7355','#D4AF37']},
  {name:'Blush & Gold',      mood:'Elegant', tones:['Warm','Pastel'],     biz:'ความงาม',    colors:['#F7CAC9','#92A8D1','#F7786B','#F9D5E5','#C2B280']},
  {name:'Amethyst Night',    mood:'Elegant', tones:['Dark','Cool'],       biz:'ความงาม',    colors:['#2E1065','#4C1D95','#7C3AED','#A78BFA','#DDD6FE']},
  {name:'Emerald Luxe',      mood:'Elegant', tones:['Dark','Cool'],       biz:'เสื้อผ้า',   colors:['#064E3B','#065F46','#047857','#34D399','#A7F3D0']},
  {name:'Wine Cellar',       mood:'Elegant', tones:['Dark','Warm'],       biz:'เครื่องดื่ม',colors:['#4A0E0E','#722F37','#A0522D','#C08552','#F3E9DC']},
  /* Elegant gaps */
  {name:'Golden Feast',      mood:'Elegant', tones:['Warm'],              biz:'อาหาร / ของกินเล่น', colors:['#5C3317','#8B5E3C','#C4A35A','#DAA520','#FFF8DC']},
  {name:'Sapphire Sip',      mood:'Elegant', tones:['Cool','Dark'],       biz:'เครื่องดื่ม',         colors:['#0D1B2A','#1B2838','#2A4365','#4A90D9','#90CDF4']},
  {name:'Gem Drink',         mood:'Elegant', tones:['Vibrant'],           biz:'เครื่องดื่ม',         colors:['#7B2CBF','#9D4EDD','#C77DFF','#E0AAFF','#F72585']},
  {name:'Pastel Treat',      mood:'Elegant', tones:['Pastel'],            biz:'อาหาร / ของกินเล่น', colors:['#F5E6CC','#FFE8D6','#DDBEA9','#CB997E','#B7B7A4']},
  {name:'Pastel Silk',       mood:'Elegant', tones:['Pastel'],            biz:'เสื้อผ้า',            colors:['#F8EDEB','#FEC5BB','#FCD5CE','#FAE1DD','#E8E8E4']},
  {name:'Dark Truffle',      mood:'Elegant', tones:['Dark','Warm'],       biz:'อาหาร / ของกินเล่น', colors:['#1C0A00','#3E1C00','#6B3A00','#A0522D','#D2B48C']},
  /* ── Bold ── */
  {name:'Fire & Steel',      mood:'Bold', tones:['Warm','Dark'],       biz:'เทคโนโลยี',          colors:['#D63031','#E17055','#2D3436','#636E72','#FDCB6E']},
  {name:'Power Black',       mood:'Bold', tones:['Dark','Neutral'],    biz:'เทคโนโลยี',          colors:['#000000','#1A1A1A','#E63946','#457B9D','#F1FAEE']},
  {name:'Urban Edge',        mood:'Bold', tones:['Vibrant','Dark'],    biz:'เสื้อผ้า',            colors:['#370617','#6A040F','#D00000','#E85D04','#FAA307']},
  {name:'Crimson Impact',    mood:'Bold', tones:['Warm','Vibrant'],    biz:'อาหาร / ของกินเล่น', colors:['#9B2335','#D4003B','#FF4136','#FF851B','#FFDC00']},
  {name:'Volt',              mood:'Bold', tones:['Vibrant'],           biz:'เทคโนโลยี',          colors:['#CCFF00','#1B1B1B','#FF0054','#00F0FF','#FFFFFF']},
  {name:'Thunder',           mood:'Bold', tones:['Dark','Vibrant'],    biz:'เสื้อผ้า',            colors:['#1B2631','#2C3E50','#E74C3C','#F39C12','#ECF0F1']},
  {name:'Red Alert',         mood:'Bold', tones:['Warm','Dark'],       biz:'อาหาร / ของกินเล่น', colors:['#6A040F','#9D0208','#D00000','#DC2F02','#F48C06']},
  {name:'Electric Blue',     mood:'Bold', tones:['Cool','Vibrant'],    biz:'เทคโนโลยี',          colors:['#0466C8','#0353A4','#023E7D','#002855','#001845']},
  {name:'Concrete Jungle',   mood:'Bold', tones:['Neutral','Dark'],    biz:'เสื้อผ้า',            colors:['#2B2D42','#8D99AE','#EDF2F4','#EF233C','#D90429']},
  {name:'Bold Brew',         mood:'Bold', tones:['Dark','Warm'],       biz:'เครื่องดื่ม',         colors:['#3C1518','#69140E','#A44200','#D58936','#F2F3AE']},
  {name:'Bold Beauty',       mood:'Bold', tones:['Vibrant','Dark'],    biz:'ความงาม',             colors:['#590D22','#800F2F','#A4133C','#C9184A','#FF4D6D']},
  /* Bold gaps */
  {name:'Bold Blush',        mood:'Bold', tones:['Warm','Dark'],       biz:'ความงาม',             colors:['#590D22','#800F2F','#A4133C','#FF758F','#FF8FA3']},
  {name:'Bold Ice',          mood:'Bold', tones:['Cool','Dark'],       biz:'เครื่องดื่ม',         colors:['#001233','#023E7D','#0466C8','#33415C','#979DAC']},
  {name:'Solid Snack',       mood:'Bold', tones:['Neutral'],           biz:'อาหาร / ของกินเล่น', colors:['#333333','#555555','#888888','#E63946','#FFB703']},
  {name:'Pastel Punch Wear', mood:'Bold', tones:['Pastel','Vibrant'],  biz:'เสื้อผ้า',            colors:['#BDE0FE','#A2D2FF','#CDB4DB','#D00000','#DC2F02']},
  {name:'Pastel Punch Glow', mood:'Bold', tones:['Pastel'],            biz:'ความงาม',             colors:['#FFC8DD','#F8EDEB','#FEC5BB','#C9184A','#FF4D6D']},
  /* Bold additional coverage */
  {name:'Bold Pastel Sip',   mood:'Bold', tones:['Pastel'],            biz:'เครื่องดื่ม',         colors:['#F8EDEB','#FEC5BB','#E63946','#DC2F02','#9D0208']},
  {name:'Bold Pastel Bite',  mood:'Bold', tones:['Pastel','Vibrant'],  biz:'อาหาร / ของกินเล่น', colors:['#FFAFCC','#BDE0FE','#DC2F02','#E85D04','#FAA307']},
  {name:'Bold Cool Wear',    mood:'Bold', tones:['Cool'],              biz:'เสื้อผ้า',            colors:['#0466C8','#0353A4','#023E7D','#E63946','#EDF2F4']},
  {name:'Bold Cool Tech',    mood:'Bold', tones:['Cool'],              biz:'เทคโนโลยี',          colors:['#03045E','#0077B6','#00B4D8','#FF4D6D','#1B2631']},
  {name:'Bold Neutral Tech', mood:'Bold', tones:['Neutral'],           biz:'เทคโนโลยี',          colors:['#212529','#495057','#ADB5BD','#E63946','#F8F9FA']},
  {name:'Bold Neutral Wear', mood:'Bold', tones:['Neutral'],           biz:'เสื้อผ้า',            colors:['#343A40','#6C757D','#ADB5BD','#E63946','#FFFFFF']},
  {name:'Bold Warm Food',    mood:'Bold', tones:['Warm'],              biz:'อาหาร / ของกินเล่น', colors:['#9D0208','#D00000','#F48C06','#FAA307','#FFBA08']},
  {name:'Bold Warm Wear',    mood:'Bold', tones:['Warm'],              biz:'เสื้อผ้า',            colors:['#370617','#6A040F','#E85D04','#F48C06','#FAA307']},
  {name:'Bold Warm Beauty',  mood:'Bold', tones:['Warm'],              biz:'ความงาม',             colors:['#9D0208','#C9184A','#FF4D6D','#F48C06','#FFE8D6']},
  {name:'Bold Vibrant Sip',  mood:'Bold', tones:['Vibrant'],           biz:'เครื่องดื่ม',         colors:['#FF006E','#8338EC','#3A86FF','#FB5607','#FFBE0B']},
  {name:'Bold Vibrant Food', mood:'Bold', tones:['Vibrant'],           biz:'อาหาร / ของกินเล่น', colors:['#E63946','#FF4D6D','#FFBE0B','#06D6A0','#118AB2']},
  {name:'Bold Vibrant Wear', mood:'Bold', tones:['Vibrant'],           biz:'เสื้อผ้า',            colors:['#FF006E','#FB5607','#FFBE0B','#8338EC','#3A86FF']},
  /* ── Extra Friendly coverage ── */
  {name:'Friendly Warm Wear',      mood:'Friendly', tones:['Warm'],           biz:'เสื้อผ้า',            colors:['#F4845F','#F79D65','#F7B267','#FEFAE0','#A0785A']},
  {name:'Friendly Warm Beauty',    mood:'Friendly', tones:['Warm'],           biz:'ความงาม',             colors:['#FFADAD','#FFD6A5','#FDFFB6','#D4A373','#FAEDCD']},
  {name:'Friendly Warm Tech',      mood:'Friendly', tones:['Warm'],           biz:'เทคโนโลยี',          colors:['#FF9F1C','#FFBF69','#CBF3F0','#2EC4B6','#F7F7F7']},
  {name:'Friendly Vibrant Wear',   mood:'Friendly', tones:['Vibrant'],        biz:'เสื้อผ้า',            colors:['#FF595E','#FFCA3A','#6A4C93','#1982C4','#8AC926']},
  {name:'Friendly Vibrant Tech',   mood:'Friendly', tones:['Vibrant'],        biz:'เทคโนโลยี',          colors:['#3A86FF','#FF006E','#FFBE0B','#8338EC','#06D6A0']},
  {name:'Friendly Cool Beauty',    mood:'Friendly', tones:['Cool'],           biz:'ความงาม',             colors:['#CAF0F8','#90E0EF','#48CAE4','#00B4D8','#F8EDEB']},
  {name:'Friendly Dark Food',      mood:'Friendly', tones:['Dark'],           biz:'อาหาร / ของกินเล่น', colors:['#3C1518','#69140E','#A44200','#D58936','#F2F3AE']},
  {name:'Friendly Dark Drink',     mood:'Friendly', tones:['Dark'],           biz:'เครื่องดื่ม',         colors:['#1B1B1B','#2D2D2D','#6B4226','#C68B59','#F5E6CC']},
  /* ── Extra Professional coverage ── */
  {name:'Pro Pastel Food',         mood:'Professional', tones:['Pastel'],        biz:'อาหาร / ของกินเล่น', colors:['#F0F4F8','#D9E2EC','#BCCCDC','#DDBEA9','#FFE8D6']},
  {name:'Pro Pastel Drink',        mood:'Professional', tones:['Pastel'],        biz:'เครื่องดื่ม',         colors:['#F0F4F8','#BDE0FE','#A2D2FF','#CDB4DB','#F8EDEB']},
  {name:'Pro Pastel Wear',         mood:'Professional', tones:['Pastel'],        biz:'เสื้อผ้า',            colors:['#D9E2EC','#BCCCDC','#9FB3C8','#EDE0D4','#F5EBE0']},
  {name:'Pro Vibrant Food',        mood:'Professional', tones:['Vibrant'],       biz:'อาหาร / ของกินเล่น', colors:['#2D6A4F','#40916C','#52B788','#74C69D','#D8F3DC']},
  {name:'Pro Vibrant Drink',       mood:'Professional', tones:['Vibrant'],       biz:'เครื่องดื่ม',         colors:['#0096C7','#00B4D8','#48CAE4','#90E0EF','#ADE8F4']},
  {name:'Pro Vibrant Wear',        mood:'Professional', tones:['Vibrant'],       biz:'เสื้อผ้า',            colors:['#264653','#2A9D8F','#E9C46A','#F4A261','#E76F51']},
  {name:'Pro Vibrant Tech',        mood:'Professional', tones:['Vibrant'],       biz:'เทคโนโลยี',          colors:['#0466C8','#0353A4','#6A00F4','#8900F2','#A100F2']},
  {name:'Pro Dark Wear',           mood:'Professional', tones:['Dark'],          biz:'เสื้อผ้า',            colors:['#0B1320','#1C2541','#3A506B','#5BC0BE','#6FFFE9']},
  {name:'Pro Dark Food',           mood:'Professional', tones:['Dark'],          biz:'อาหาร / ของกินเล่น', colors:['#1B1B1B','#2D2D2D','#6B4226','#A44200','#C68B59']},
  {name:'Pro Warm Food',           mood:'Professional', tones:['Warm'],          biz:'อาหาร / ของกินเล่น', colors:['#4A1C10','#7B3F00','#C08552','#D4A373','#FEFAE0']},
  {name:'Pro Warm Wear',           mood:'Professional', tones:['Warm'],          biz:'เสื้อผ้า',            colors:['#7B3F00','#A0522D','#C08552','#DEB887','#F5F5DC']},
  {name:'Pro Warm Beauty',         mood:'Professional', tones:['Warm'],          biz:'ความงาม',             colors:['#8B5E3C','#C4A35A','#DAA520','#F5F5DC','#FAF0E6']},
  {name:'Pro Cool Wear',           mood:'Professional', tones:['Cool'],          biz:'เสื้อผ้า',            colors:['#03045E','#023E8A','#0077B6','#90E0EF','#CAF0F8']},
  {name:'Pro Cool Beauty',         mood:'Professional', tones:['Cool'],          biz:'ความงาม',             colors:['#0077B6','#0096C7','#00B4D8','#ADE8F4','#CAF0F8']},
  {name:'Pro Neutral Food',        mood:'Professional', tones:['Neutral'],       biz:'อาหาร / ของกินเล่น', colors:['#3D3D3D','#616161','#9E9E9E','#F5F5F5','#DDA15E']},
  {name:'Pro Neutral Wear',        mood:'Professional', tones:['Neutral'],       biz:'เสื้อผ้า',            colors:['#212121','#424242','#757575','#BDBDBD','#F5F5F5']},
  {name:'Pro Neutral Tech',        mood:'Professional', tones:['Neutral'],       biz:'เทคโนโลยี',          colors:['#1C1C1E','#3A3A3C','#636366','#AEAEB2','#F2F2F7']},
  /* ── Extra Playful coverage ── */
  {name:'Playful Cool Wear',       mood:'Playful', tones:['Cool'],          biz:'เสื้อผ้า',            colors:['#00B4D8','#0096C7','#CAF0F8','#FF595E','#FFCA3A']},
  {name:'Playful Cool Tech',       mood:'Playful', tones:['Cool'],          biz:'เทคโนโลยี',          colors:['#48CAE4','#00B4D8','#ADE8F4','#FF595E','#8AC926']},
  {name:'Playful Cool Beauty',     mood:'Playful', tones:['Cool'],          biz:'ความงาม',             colors:['#CAF0F8','#90E0EF','#FFAFCC','#FFC8DD','#BDE0FE']},
  {name:'Playful Neutral Wear',    mood:'Playful', tones:['Neutral'],       biz:'เสื้อผ้า',            colors:['#E8E8E4','#D6CCC2','#FF595E','#FFCA3A','#8AC926']},
  {name:'Playful Neutral Tech',    mood:'Playful', tones:['Neutral'],       biz:'เทคโนโลยี',          colors:['#F8F9FA','#E9ECEF','#FF595E','#FFCA3A','#6A4C93']},
  {name:'Playful Neutral Beauty',  mood:'Playful', tones:['Neutral'],       biz:'ความงาม',             colors:['#E8E8E4','#D6CCC2','#F5EBE0','#FF99C8','#FCF6BD']},
  {name:'Playful Dark Wear',       mood:'Playful', tones:['Dark'],          biz:'เสื้อผ้า',            colors:['#1A0633','#3D1C6E','#822FAF','#FF595E','#FFCA3A']},
  {name:'Playful Dark Tech',       mood:'Playful', tones:['Dark'],          biz:'เทคโนโลยี',          colors:['#0D0D0D','#1F1F1F','#7400B8','#FF006E','#FFBE0B']},
  {name:'Playful Dark Beauty',     mood:'Playful', tones:['Dark'],          biz:'ความงาม',             colors:['#2B0B3F','#6B2FA0','#FF2281','#FF6D28','#FFBC42']},
  {name:'Playful Warm Wear',       mood:'Playful', tones:['Warm'],          biz:'เสื้อผ้า',            colors:['#FF595E','#FF9F1C','#FFBE0B','#FF6B6B','#FFA07A']},
  {name:'Playful Warm Beauty',     mood:'Playful', tones:['Warm'],          biz:'ความงาม',             colors:['#FF99C8','#FF6B6B','#FFA07A','#FFD700','#F7AEF8']},
  {name:'Playful Warm Tech',       mood:'Playful', tones:['Warm'],          biz:'เทคโนโลยี',          colors:['#FF6B35','#FF9F1C','#FFBE0B','#8AC926','#1982C4']},
  {name:'Playful Pastel Food',     mood:'Playful', tones:['Pastel'],        biz:'อาหาร / ของกินเล่น', colors:['#FFADAD','#FFD6A5','#FDFFB6','#CAFFBF','#9BF6FF']},
  {name:'Playful Pastel Wear',     mood:'Playful', tones:['Pastel'],        biz:'เสื้อผ้า',            colors:['#FFAFCC','#FFC8DD','#BDE0FE','#A2D2FF','#CDB4DB']},
  {name:'Playful Pastel Tech',     mood:'Playful', tones:['Pastel'],        biz:'เทคโนโลยี',          colors:['#BDE0FE','#A2D2FF','#CAFFBF','#FDFFB6','#FFAFCC']},
  {name:'Playful Vibrant Wear',    mood:'Playful', tones:['Vibrant'],       biz:'เสื้อผ้า',            colors:['#FF006E','#FB5607','#FFBE0B','#8338EC','#3A86FF']},
  {name:'Playful Vibrant Tech',    mood:'Playful', tones:['Vibrant'],       biz:'เทคโนโลยี',          colors:['#7400B8','#6930C3','#FFCA3A','#FF006E','#3A86FF']},
  {name:'Playful Vibrant Beauty',  mood:'Playful', tones:['Vibrant'],       biz:'ความงาม',             colors:['#FF99C8','#FF006E','#FFBE0B','#8338EC','#FCF6BD']},
  /* ── Extra Elegant coverage ── */
  {name:'Elegant Warm Food',       mood:'Elegant', tones:['Warm'],          biz:'อาหาร / ของกินเล่น', colors:['#5C3317','#8B5E3C','#C4A35A','#DAA520','#FFF8DC']},
  {name:'Elegant Warm Wear',       mood:'Elegant', tones:['Warm','Pastel'], biz:'เสื้อผ้า',            colors:['#B76E79','#DDB3B3','#F2D0D0','#C2A06E','#FAF0E6']},
  {name:'Elegant Warm Tech',       mood:'Elegant', tones:['Warm'],          biz:'เทคโนโลยี',          colors:['#4A1C10','#7B2D00','#C08552','#D4A373','#F5EBE0']},
  {name:'Elegant Cool Food',       mood:'Elegant', tones:['Cool','Dark'],   biz:'อาหาร / ของกินเล่น', colors:['#0D1B2A','#1B2838','#2A4365','#4A90D9','#EEE8AA']},
  {name:'Elegant Cool Wear',       mood:'Elegant', tones:['Cool'],          biz:'เสื้อผ้า',            colors:['#03045E','#023E8A','#0077B6','#A8DADC','#F1FAEE']},
  {name:'Elegant Cool Tech',       mood:'Elegant', tones:['Cool'],          biz:'เทคโนโลยี',          colors:['#10002B','#240046','#3C096C','#4EA8DE','#90E0EF']},
  {name:'Elegant Cool Beauty',     mood:'Elegant', tones:['Cool'],          biz:'ความงาม',             colors:['#03045E','#023E8A','#0077B6','#A0C4FF','#FDE8FF']},
  {name:'Elegant Neutral Food',    mood:'Elegant', tones:['Neutral'],       biz:'อาหาร / ของกินเล่น', colors:['#5C4033','#8B6914','#C4A35A','#EEE8AA','#FFF8DC']},
  {name:'Elegant Neutral Drink',   mood:'Elegant', tones:['Neutral'],       biz:'เครื่องดื่ม',         colors:['#606060','#888888','#AAAAAA','#DAA520','#FFF8DC']},
  {name:'Elegant Neutral Wear',    mood:'Elegant', tones:['Neutral'],       biz:'เสื้อผ้า',            colors:['#2D2926','#4A4A4A','#8B8B8B','#D4AF37','#FAF0E6']},
  {name:'Elegant Neutral Tech',    mood:'Elegant', tones:['Neutral'],       biz:'เทคโนโลยี',          colors:['#1A1A2E','#2D2D2D','#6C5CE7','#A78BFA','#E8E8E4']},
  {name:'Elegant Neutral Beauty',  mood:'Elegant', tones:['Neutral'],       biz:'ความงาม',             colors:['#3D2C2C','#5C4033','#C4A35A','#DEB887','#FAF0E6']},
  {name:'Elegant Vibrant Food',    mood:'Elegant', tones:['Vibrant'],       biz:'อาหาร / ของกินเล่น', colors:['#7B2CBF','#9D4EDD','#C77DFF','#DAA520','#FFF8DC']},
  {name:'Elegant Vibrant Drink',   mood:'Elegant', tones:['Vibrant'],       biz:'เครื่องดื่ม',         colors:['#6C5CE7','#7B2CBF','#9D4EDD','#E0AAFF','#F1FAEE']},
  {name:'Elegant Vibrant Wear',    mood:'Elegant', tones:['Vibrant'],       biz:'เสื้อผ้า',            colors:['#6C5CE7','#A29BFE','#FD79A8','#FAB1D3','#F8EDEB']},
  {name:'Elegant Vibrant Tech',    mood:'Elegant', tones:['Vibrant'],       biz:'เทคโนโลยี',          colors:['#10002B','#3C096C','#7B2CBF','#C77DFF','#DAA520']},
  {name:'Elegant Pastel Food',     mood:'Elegant', tones:['Pastel'],        biz:'อาหาร / ของกินเล่น', colors:['#F5E6CC','#FFE8D6','#DDBEA9','#CB997E','#FFF8DC']},
  {name:'Elegant Pastel Drink',    mood:'Elegant', tones:['Pastel'],        biz:'เครื่องดื่ม',         colors:['#DDD6FE','#C4B5FD','#A78BFA','#F3E8FF','#FDE8FF']},
  {name:'Elegant Pastel Tech',     mood:'Elegant', tones:['Pastel'],        biz:'เทคโนโลยี',          colors:['#DDD6FE','#C4B5FD','#FDE8FF','#F3E8FF','#EDE9FE']},
  {name:'Elegant Pastel Beauty',   mood:'Elegant', tones:['Pastel'],        biz:'ความงาม',             colors:['#FDE8FF','#F3E8FF','#DDD6FE','#FFC8DD','#FFAFCC']},
];

const CNCPT_MOOD_LABELS = {
  friendly:'เป็นกันเอง', professional:'มืออาชีพ', playful:'สนุกสนาน',
  luxury:'หรูหรา', bold:'โดดเด่น', minimal:'เรียบง่าย',
  creative:'สร้างสรรค์', retro:'ย้อนยุค',
};
const CNCPT_MOOD_ICONS = {
  friendly:'mdi:emoticon-happy-outline', professional:'mdi:briefcase-outline',
  playful:'mdi:party-popper', luxury:'mdi:diamond-stone',
  bold:'mdi:flash-outline', minimal:'mdi:minus-circle-outline',
  creative:'mdi:palette-outline', retro:'mdi:clock-outline',
};
const CNCPT_STYLE_LABEL = {
  'sans-serif':'Sans Serif','serif':'Serif','display':'Display',
  'handwriting':'Handwriting','monospace':'Monospace',
};
const CNCPT_STYLE_TH2EN = {
  'ไม่มีหัว (Sans Serif)':'sans-serif','มีหัว (Serif)':'serif',
  'ดิสเพลย์ (Display)':'display','ลายมือ (Handwriting)':'handwriting',
  'โมโนสเปซ (Monospace)':'monospace',
};
const CNCPT_THAI_FONTS = new Set([
  'Bai Jamjuree','Chakra Petch','Charm','Charmonman','Chonburi',
  'Fahkwang','Itim','K2D','Kanit','Kodchasan','Krub','Kittithada',
  'Mitr','Niramit','Noto Sans Thai','Noto Serif Thai',
  'Pridi','Prompt','Sarabun','Srisakdi','Sriracha','Taviraj','Trirong','Athiti',
]);
const CNCPT_KNOWN_FONT_MOODS = {
  'Bai Jamjuree':['professional','minimal'],'Chakra Petch':['bold','professional'],
  'Charm':['creative','retro'],'Charmonman':['creative','luxury'],'Chonburi':['bold','playful'],
  'Fahkwang':['minimal','professional'],'Itim':['friendly','playful'],'K2D':['minimal','professional'],
  'Kanit':['professional','friendly'],'Kodchasan':['friendly','minimal'],'Krub':['professional','minimal'],
  'Kittithada':['creative','retro'],'Mitr':['friendly','playful'],'Niramit':['minimal','professional'],
  'Noto Sans Thai':['professional','minimal'],'Noto Serif Thai':['professional','luxury'],
  'Pridi':['retro','professional'],'Prompt':['professional','minimal'],'Sarabun':['minimal','professional'],
  'Srisakdi':['creative','retro'],'Sriracha':['playful','friendly'],'Taviraj':['luxury','retro'],
  'Trirong':['luxury','retro'],'Athiti':['friendly','minimal'],
  'Montserrat':['professional','bold'],'Roboto':['professional','minimal'],
  'Open Sans':['friendly','professional'],'Lato':['friendly','professional'],
  'Poppins':['friendly','minimal'],'Playfair Display':['luxury','retro'],
  'Raleway':['minimal','luxury'],'Merriweather':['retro','professional'],'Oswald':['bold','professional'],
  'Bebas Neue':['bold','minimal'],'Lobster':['playful','creative'],'Pacifico':['playful','friendly'],
  'Dancing Script':['creative','friendly'],'Caveat':['friendly','creative'],'Permanent Marker':['bold','playful'],
  'Abril Fatface':['luxury','bold'],'Cormorant Garamond':['luxury','retro'],'Comfortaa':['friendly','playful'],
  'Quicksand':['friendly','minimal'],'Nunito':['friendly','playful'],'Fredoka One':['playful','bold'],
  'Josefin Sans':['minimal','luxury'],'Space Mono':['creative','minimal'],'Courier Prime':['retro','professional'],
  'IBM Plex Mono':['professional','minimal'],'Fira Code':['professional','minimal'],'Anton':['bold','professional'],
  'Archivo Black':['bold','professional'],'Righteous':['bold','playful'],'Satisfy':['creative','luxury'],
  'Great Vibes':['luxury','creative'],'Sacramento':['luxury','creative'],'Indie Flower':['playful','friendly'],
  'Patrick Hand':['friendly','playful'],'Gloria Hallelujah':['playful','creative'],'Bangers':['playful','bold'],
  'Press Start 2P':['retro','playful'],'VT323':['retro','creative'],'Special Elite':['retro','creative'],
};
const CNCPT_GOOGLE_FONTS_API_KEY = 'AIzaSyCE-nEHbxSxoWLpnm6UwxOVbylAQAwTFQ0';

/* ── Local font dataset (โหลดไฟล์จาก server) ── */
const CNCPT_LOCAL_FONTS = [
  { name:'399PANI TuayJiew',   file:'../font/399PANITuayJiew/399PANITuayJiewDemo-Regular.ttf',                    type:'display',     thai:true, local:true, moods:['creative','retro'] },
  { name:'Jao Chathai',        file:'../font/JaoChathai/JaoChathaiThin.ttf',                                      type:'serif',       thai:true, local:true, moods:['luxury','retro'] },
  { name:'Kart-Thai Esan',     file:'../font/Kart-Thai-Esan/Kart-Thai Esan DEMO.ttf',                            type:'display',     thai:true, local:true, moods:['bold','creative'] },
  { name:'Kart-Kean Fome',     file:'../font/kart-kean-fome/Kart-Kean Fome DEMO.ttf',                            type:'display',     thai:true, local:true, moods:['playful','creative'] },
  { name:'MN Nugget',          file:'../font/MN-Nugget/นักเก็ตแจก/MN Nugget.otf',                               type:'display',     thai:true, local:true, moods:['playful','friendly'] },
  { name:'MN Nugget Italic',   file:'../font/MN-Nugget/นักเก็ตแจก/MN Nugget Italic.otf',                        type:'display',     thai:true, local:true, moods:['playful','friendly'] },
  { name:'MN Tam Thai',        file:'../font/MN-Tam-Thai/ตำไทย/MN Tam Thai.ttf',                                type:'serif',       thai:true, local:true, moods:['retro','professional'] },
  { name:'MN Tam Thai Italic', file:'../font/MN-Tam-Thai/ตำไทย/MN Tam Thai Italic.ttf',                         type:'serif',       thai:true, local:true, moods:['retro','professional'] },
  { name:'RD Konmek',          file:'../font/RDKonmek/RDKonmek.ttf',                                             type:'sans-serif',  thai:true, local:true, moods:['professional','friendly'] },
  { name:'RD Konmek SPC',      file:'../font/RDKonmek/RDKonmekSPC.ttf',                                         type:'display',     thai:true, local:true, moods:['bold','professional'] },
  { name:'TCS 4KhaiMook',      file:'../font/TCS-4KhaiMook/TCS-4KhaiMook-PersonalOnly.ttf',                     type:'handwriting', thai:true, local:true, moods:['friendly','creative'] },
  { name:'was iittrakorn',     file:'../font/was-iittrakorn/was@iittrakornFont.ttf',                              type:'handwriting', thai:true, local:true, moods:['creative','playful'] },
];

function cncptInjectLocalFontFaces() {
  if (document.getElementById('cncpt-local-font-faces')) return;
  const style = document.createElement('style');
  style.id = 'cncpt-local-font-faces';
  style.textContent = CNCPT_LOCAL_FONTS.map(f => {
    const fmt = f.file.endsWith('.otf') ? 'opentype' : 'truetype';
    return `@font-face { font-family: '${f.name}'; src: url('${f.file}') format('${fmt}'); font-display: swap; }`;
  }).join('\n');
  document.head.appendChild(style);
}

// แปลง font ที่ save ไว้ใน DB (font_name) ให้เป็นรูปแบบเดียวกับ pool item ที่ grid ฟอนต์ใช้
// ถ้าชื่อ font ตรงกับ CNCPT_LOCAL_FONTS จะดึง type/thai/moods ของ local font นั้นมาใช้เลย
function cncptBuildFontPoolFromDb(dbFonts) {
  return (dbFonts || []).map(f => {
    const name = f.font_name;
    const localMatch = CNCPT_LOCAL_FONTS.find(lf => lf.name === name);
    const type  = localMatch?.type || 'sans-serif';
    const thai  = localMatch ? localMatch.thai : CNCPT_THAI_FONTS.has(name);
    const local = !!localMatch;
    const moods = localMatch?.moods || cncptClassifyFontMood({ name, type });
    return { name, gf: name.replace(/ /g,'+'), type, thai, local, moods, file: localMatch?.file };
  });
}

/* ── helper functions (Color & Font) ── */
function cncptClassifyFontMood(font) {
  if (CNCPT_KNOWN_FONT_MOODS[font.name]) return CNCPT_KNOWN_FONT_MOODS[font.name];
  const name = font.name.toLowerCase();
  const cat  = font.type;
  const namePatterns = {
    playful:  /comic|bubble|fun|bounce|candy|jelly|cute|jolly|happy|laugh|cartoon|round|groovy/,
    luxury:   /vogue|elegant|glamour|luxury|royal|noble|deluxe|gold|grace|majestic|silk/,
    bold:     /black|heavy|impact|ultra|strong|power|titan|mega|thunder|gothic|grunge|strike/,
    retro:    /retro|vintage|classic|antique|old|heritage|typewriter|western|deco|victorian/,
    creative: /art|creative|abstract|sketch|brush|ink|paint|graffiti|neon|pixel|magic/,
    friendly: /friendly|warm|soft|gentle|cozy|sweet|love|heart|smile|casual/,
    minimal:  /thin|light|slim|condensed|clean|simple|mono|geometric|neue|sans/,
  };
  const moods = new Set();
  for (const [mood, regex] of Object.entries(namePatterns)) {
    if (regex.test(name)) moods.add(mood);
  }
  switch (cat) {
    case 'serif':       if (!moods.size) { moods.add('professional'); moods.add('retro'); } break;
    case 'sans-serif':  if (!moods.size) { moods.add('professional'); moods.add('minimal'); } break;
    case 'display':     if (!moods.size) { moods.add('bold'); moods.add('creative'); } break;
    case 'handwriting': if (!moods.size) { moods.add('friendly'); moods.add('creative'); } break;
    case 'monospace':   if (!moods.size) { moods.add('minimal'); moods.add('professional'); } break;
    default:            if (!moods.size) { moods.add('professional'); }
  }
  return [...moods].slice(0, 2);
}
function cncptHexToRgb(hex) {
  const n = parseInt(hex.replace('#',''),16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function cncptContrastColor(hex) {
  const [r,g,b] = cncptHexToRgb(hex);
  return (0.299*r+0.587*g+0.114*b)/255>0.55?'#222':'#fff';
}
function cncptMoodTH(en){ return CNCPT_EN2TH_MOOD[en]||en; }
function cncptToneTH(en){ return CNCPT_EN2TH_TONE[en]||en; }

function cncptDetectTones(hexArr) {
  const counts = {};
  hexArr.forEach(hex => {
    const [r,g,b] = cncptHexToRgb(hex);
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    const l=(max+min)/2/255*100;
    const s=max===min?0:(max-min)/(l<50?max+min:510-max-min)*100;
    let h=0;
    if(max!==min){
      if(max===r) h=((g-b)/(max-min)+6)%6*60;
      else if(max===g) h=((b-r)/(max-min)+2)*60;
      else h=((r-g)/(max-min)+4)*60;
    }
    let tone='Neutral';
    if(l<30) tone='Dark';
    else if(l>70&&s<50) tone='Pastel';
    else if(s>65) tone='Vibrant';
    else if(h>=0&&h<=60) tone='Warm';
    else if(h>=180&&h<=270) tone='Cool';
    counts[tone]=(counts[tone]||0)+1;
  });
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0]);
}

// แปลง palette ที่ save ไว้ใน DB (name_palette + color_code_1..5) ให้เป็นรูปแบบเดียวกับ pool item
// เพื่อเอาไปแสดงบน grid ได้ทันที — ถ้าชื่อ palette ตรงกับ CNCPT_PALETTE_LIBRARY จะดึง mood/tones/biz มาโชว์ด้วย
function cncptBuildPoolFromDb(dbPalettes) {
  return (dbPalettes || []).map(p => {
    const colors = [p.color_code_1, p.color_code_2, p.color_code_3, p.color_code_4, p.color_code_5].filter(Boolean);
    const libMatch = CNCPT_PALETTE_LIBRARY.find(lib => lib.name === p.name_palette);
    return {
      name:   p.name_palette,
      colors,
      mood:   libMatch?.mood  || '',
      tones:  libMatch?.tones || (colors.length ? cncptDetectTones(colors) : []),
      biz:    libMatch?.biz   || '',
      source: 'database',
    };
  });
}

const CNCPT_MOOD_SEEDS = {
  'Friendly':     { hex:'FF6B35', modes:['analogic','complement'] },
  'Professional': { hex:'2C3E50', modes:['monochrome','analogic-complement'] },
  'Playful':      { hex:'FFCA3A', modes:['triad','quad'] },
  'Elegant':      { hex:'6C5CE7', modes:['analogic','monochrome-dark'] },
  'Bold':         { hex:'D63031', modes:['complement','analogic-complement'] },
};
const CNCPT_BIZ_NAMES = {
  'อาหาร / ของกินเล่น': ['Yummy Delight','Harvest Warmth','Fresh Bite','Spice Route','Golden Harvest'],
  'เครื่องดื่ม':          ['Refreshing Sip','Smooth Blend','Cool Drop','Morning Dew','Brew House'],
  'เสื้อผ้า':             ['Style Forward','Urban Chic','Soft Touch','Thread Story','Fabric Flow'],
  'ความงาม':             ['Glow Up','Rose Petal','Pure Radiance','Velvet Touch','Bloom Serum'],
  'เทคโนโลยี':           ['Circuit Blue','Dark Mode','Clean Logic','Byte Light','Neon Signal'],
};

async function cncptFetchScheme(seedHex, mode) {
  try {
    const res = await fetch(`https://www.thecolorapi.com/scheme?hex=${seedHex}&mode=${mode}&count=5&format=json`);
    if (!res.ok) throw new Error('scheme error');
    const data = await res.json();
    return data.colors.map(c => c.hex.value);
  } catch { return null; }
}

async function cncptFetchColormind(inputColors) {
  try {
    const body = { model: 'default' };
    if (inputColors?.length) {
      const model = inputColors.map(c => {
        if (!c) return 'N';
        const [r,g,b] = cncptHexToRgb(c);
        return [r,g,b];
      });
      while (model.length < 5) model.push('N');
      body.input = model;
    }
    const res = await fetch('http://colormind.io/api/', {
      method:'POST', body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('colormind error');
    const data = await res.json();
    if (!data.result) throw new Error('no result');
    return data.result.map(rgb => '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''));
  } catch { return null; }
}

async function cncptGenerateColorPool(moodsEN, tonesEN, biz) {
  const results = [];
  // 1) Dataset — เสมอมี
  CNCPT_PALETTE_LIBRARY.forEach(p => results.push({...p, source:'dataset'}));

  const moodList = moodsEN.length ? moodsEN : Object.keys(CNCPT_MOOD_SEEDS);
  const nameList = CNCPT_BIZ_NAMES[biz] || ['Palette A','Palette B','Palette C','Palette D','Palette E'];
  let ni = 0;

  // 2) thecolorapi.com — optional bonus
  for (const mood of moodList) {
    const cfg = CNCPT_MOOD_SEEDS[mood];
    if (!cfg) continue;
    for (const mode of cfg.modes) {
      const colors = await cncptFetchScheme(cfg.hex, mode);
      if (!colors) continue;
      results.push({
        name: nameList[ni % nameList.length] + ' (API)',
        mood, tones: cncptDetectTones(colors), biz: biz||'',
        colors, source:'thecolorapi',
      });
      ni++;
    }
  }

  // 3) Colormind — optional bonus
  const colormindSeeds = {
    'Friendly':     ['#FF6B35',null,null,null,null],
    'Professional': ['#2C3E50',null,null,null,null],
    'Playful':      ['#FFCA3A',null,null,null,null],
    'Elegant':      ['#6C5CE7',null,null,null,null],
    'Bold':         ['#D63031',null,null,null,null],
  };
  for (const mood of moodList) {
    const seed = colormindSeeds[mood];
    if (!seed) continue;
    const colors = await cncptFetchColormind(seed);
    if (!colors) continue;
    results.push({
      name: (CNCPT_BIZ_NAMES[biz]||['Colormind Palette'])[ni % 5] + ' (CM)',
      mood, tones: cncptDetectTones(colors), biz: biz||'',
      colors, source:'colormind',
    });
    ni++;
  }

  return results;
}

/* ── Shared helper sub-components (Color & Font tabs only) ── */
function CncptIcon({ icon, width }) {
  return <iconify-icon icon={icon} width={width || "16"} style={{display:'inline-block', verticalAlign:'middle', flexShrink:0}} />;
}
function CncptTag({ children, active, onClick, shake }) {
  return (
    <span
      className={`cncpt-tag${active?' cncpt-active':''}${shake?' cncpt-tag-shake':''}`}
      onClick={onClick}
    >{children}</span>
  );
}
function CncptDropdown({ id, value, placeholder, options, onSelect, openDd, setOpenDd }) {
  const isOpen = openDd === id;
  return (
    <div className={`cncpt-cc-dd${isOpen?' cncpt-open':''}`}>
      <div className="cncpt-cc-dd-sel" onClick={() => setOpenDd(isOpen ? '' : id)}>
        <span className={value ? '' : 'cncpt-dd-placeholder'}>{value || placeholder}</span>
        <CncptIcon icon="mdi:chevron-down" />
      </div>
      <ul className="cncpt-cc-dd-list">
        {options.map(opt => (
          <li key={opt} onClick={() => { onSelect(opt); setOpenDd(''); }}>{opt}</li>
        ))}
      </ul>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT  — original CreateConcept (unchanged) +
                     Color & Font sections added below
   ============================================================ */
export const CreateConcept = () => {
  const navigate   = useNavigate();
  const location   = useLocation();
  const projectId  = location.state?.projectId;
  const userData   = JSON.parse(localStorage.getItem('user') || '{}');
  const userId     = userData.user_id || 0;
  const initialTab = location.state?.activeTab || 'name'; 
  const [activeTab, setActiveTab] = useState(initialTab);
  // ─────────────────────────────────────────────────────────
  // ORIGINAL STATE (unchanged)
  // ─────────────────────────────────────────────────────────
  
  const [loading, setLoading]       = useState({ show: false, text: '' });
  const [activeDropdown, setActiveDropdown] = useState(null);

  const [modals, setModals] = useState({ name: false });
  const openModal  = (type) => setModals({ ...modals, [type]: true });
  const closeModal = (type) => {
    setModals({ ...modals, [type]: false });
    if (type === 'name') setNmErrors({});
  };

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleDropdownClick = (e, id) => {
    e.stopPropagation();
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  // ── NAME SECTION STATES (original, unchanged) ──
  const [nmForm, setNmForm] = useState({ product:'', cat:'', benefit:'', target:'', tags:[], special:'' });
  const [useDna, setUseDna]   = useState(false);
  const [nmErrors, setNmErrors] = useState({});
  const [namesList, setNamesList] = useState([]);
  const [customBrandName, setCustomBrandName] = useState('');
  const [savingCustomName, setSavingCustomName] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchNames();
      fetch(`${API_URL}/api/projects/detail/${projectId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'success' && data.project.brand_name) {
            setCustomBrandName(data.project.brand_name);
          }
        })
        .catch(err => console.error(err));
    }
  }, [projectId]);

  // ดึงพาเลทที่ save ไว้แล้วของโปรเจกต์นี้ (ใช้ endpoint เดิมที่มีอยู่จริง — ไม่แตะ server.js)
  // ใช้ GET /api/color-palettes/:projectId
  const fetchDbPalettes = async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_URL}/api/color-palettes/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') {
        const palettes = data.palettes || [];
        setCncptDbPalettes(palettes);
        // สร้าง lookup map: name_palette → { color_id, concept_id, is_liked, is_selected }
        const map = {};
        palettes.forEach(p => {
          map[p.name_palette] = {
            color_id:   p.color_id,
            concept_id: p.concept_id,
            is_liked:   !!p.is_liked,
            is_selected:!!p.is_selected,
          };
        });
        setCncptDbMap(map);
        const favNames = new Set(palettes.filter(p => p.is_liked).map(p => p.name_palette));
        setCncptFavPalettes(favNames);
        const selName = palettes.find(p => p.is_selected)?.name_palette || '';
        if (selName) setCncptSelectedPalette(selName);

        // โชว์ dataset เต็ม 178 พาเลทเป็นฐานเสมอ (ไม่ต้องพึ่ง server) + เติมพาเลทที่โปรเจกต์นี้เคย save
        // ไว้แต่ไม่ได้อยู่ใน dataset (เช่นพาเลทที่มาจาก colormind ตอน generate) เข้าไปด้วย
        const libNames = new Set(CNCPT_PALETTE_LIBRARY.map(p => p.name));
        const dbOnlyPalettes = cncptBuildPoolFromDb(palettes).filter(p => !libNames.has(p.name));
        const pool = [...CNCPT_PALETTE_LIBRARY.map(p => ({...p, source:'dataset'})), ...dbOnlyPalettes];
        setCncptColorPool(pool);
        const filtered = cncptApplyColorFilters(pool, '', '', '', false, favNames);
        setCncptColorFiltered(filtered);
        setCncptColorShown(Math.min(cncptColorPageSize, filtered.length));
        setCncptColorResult(true);
      }
    } catch(err) {
      console.error('fetchDbPalettes error:', err);
      // fallback: ถ้า API มีปัญหา ใช้ dataset ในเครื่องไปก่อน กันหน้าว่าง
      const pool = CNCPT_PALETTE_LIBRARY.map(p=>({...p, source:'dataset'}));
      setCncptColorPool(pool);
      setCncptColorFiltered(pool);
      setCncptColorShown(Math.min(cncptColorPageSize, pool.length));
      setCncptColorResult(true);
    }
  };
  useEffect(() => { if (projectId) fetchDbPalettes(); }, [projectId]);

  // ดึง Google Fonts (cache ไว้ใน cncptRawFonts กันยิงซ้ำ) — ใช้ร่วมกันทั้งตอนโหลดหน้าแรกและตอนกดในป็อปอัพ
  async function cncptFetchGoogleFonts() {
    if (cncptRawFonts.length) return cncptRawFonts;
    try {
      const res = await fetch(`https://www.googleapis.com/webfonts/v1/webfonts?key=${CNCPT_GOOGLE_FONTS_API_KEY}&sort=popularity`);
      if (!res.ok) throw new Error('google fonts api error');
      const data = await res.json();
      const googleFonts = data.items.map(font => {
        const f = { name:font.family, gf:font.family.replace(/ /g,'+'), type:font.category, thai:CNCPT_THAI_FONTS.has(font.family), local:false };
        f.moods = cncptClassifyFontMood(f);
        return f;
      });
      setCncptRawFonts(googleFonts);
      // sync Google Fonts ลง table font (background, ไม่ block UI)
      fetch(`${API_URL}/api/fonts/sync-google`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fonts: googleFonts.map(f => ({ font_name: f.name })) }),
      }).catch(err => console.warn('[sync-google]', err));
      return googleFonts;
    } catch(err) {
      console.warn('[Fonts] Google API failed, using local only:', err.message);
      return [];
    }
  }

  // ดึง font ทั้งหมดจากตาราง font (master) พร้อมสถานะ like/select ของโปรเจกต์นี้ ในคิวรีเดียว
  // ใช้ GET /api/fonts/all/:projectId (endpoint นี้มีอยู่แล้วใน backend) + เสริม Google Fonts สดๆ เข้าไปด้วย
  const fetchAllFonts = async () => {
    if (!projectId) return;
    cncptInjectLocalFontFaces();
    const googleFonts = await cncptFetchGoogleFonts();
    const localNames  = new Set(CNCPT_LOCAL_FONTS.map(f=>f.name));
    const googleNames = new Set(googleFonts.map(f=>f.name));

    let dbRows = [];
    try {
      const res = await fetch(`${API_URL}/api/fonts/all/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') dbRows = data.fonts || [];
    } catch(err) {
      console.error('fetchAllFonts error:', err);
    }

    // sync สถานะ like/select ของโปรเจกต์นี้ (มาจาก LEFT JOIN font_concept)
    const map = {};
    const favNames = new Set();
    dbRows.forEach(f => {
      map[f.font_name] = { font_id: f.font_id, concept_id: f.concept_id, is_liked: !!f.is_liked, is_selected: !!f.is_selected };
      if (f.is_liked) favNames.add(f.font_name);
    });
    setCncptDbFontMap(map);
    setCncptFavFonts(favNames);
    const selFont = dbRows.find(f => f.is_selected);
    if (selFont) setCncptSelectedFontName(selFont.font_name);

    // pool ที่โชว์ = local fonts + Google Fonts (ทั้งหมด, สดจาก API) + font ใน DB ที่ยังไม่ซ้ำกับ 2 แหล่งแรก
    const dbOnlyFonts = cncptBuildFontPoolFromDb(dbRows).filter(f=>!localNames.has(f.name) && !googleNames.has(f.name));
    const pool = [...CNCPT_LOCAL_FONTS, ...googleFonts, ...dbOnlyFonts];
    setCncptFontPool(pool);
    const filtered = cncptApplyFontFilters(pool, '', '', '');
    setCncptFontsFiltered(filtered);
    setCncptFontsShown(Math.min(cncptFontPageSize, filtered.length));
    setCncptFontResult(true);
    setCncptFeaturedIdx(0);
    cncptLoadGoogleFont(filtered[0]);
  };
  useEffect(() => { if (projectId) fetchAllFonts(); }, [projectId]);

  const fetchNames = async () => {
    try {
      const res  = await fetch(`${API_URL}/api/brand-names/${projectId}`);
      const data = await res.json();
      if (data.status === 'success') setNamesList(data.names);
    } catch (err) { console.error(err); }
  };

  const toggleNmTag = (tag) => {
    setNmForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
    }));
    if (nmErrors.tags) setNmErrors(prev => ({ ...prev, tags: false }));
  };

  const submitName = async () => {
    let errs = {};
    if (!nmForm.product.trim()) errs.product = true;
    if (!nmForm.cat)            errs.cat     = true;
    if (!useDna && !nmForm.target) errs.target = true;
    if (nmForm.tags.length === 0)  errs.tags   = true;
    if (Object.keys(errs).length > 0) { setNmErrors(errs); return; }

    closeModal('name');
    setLoading({ show: true, text: 'AI กำลังคิดชื่อแบรนด์ 10 ชื่อให้คุณ...' });
    try {
      const payload = {
        project_id: projectId, user_id: userId,
        product: nmForm.product, category: nmForm.cat,
        benefit: nmForm.benefit, target: nmForm.target,
        tags: nmForm.tags, special: nmForm.special, use_dna: useDna
      };
      const res  = await fetch(`${API_URL}/api/generate-brand-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') fetchNames();
      else alert("Error: " + data.message);
    } catch (err) {
      alert("ไม่สามารถติดต่อ AI ได้");
    } finally {
      setLoading({ show: false, text: '' });
    }
  };

  const handleLike = async (conceptId, currentStatus) => {
    try {
      await fetch(`${API_URL}/api/brand-names/like/${conceptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_liked: !currentStatus })
      });
      fetchNames();
    } catch (err) { console.error(err); }
  };

  const handleSelect = async (conceptId) => {
    try {
      await fetch(`${API_URL}/api/brand-names/select/${conceptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId })
      });
      fetchNames();
      const res = await fetch(`${API_URL}/api/projects/detail/${projectId}`);
      const data = await res.json();
      if (data.status === 'success' && data.project.brand_name) {
        setCustomBrandName(data.project.brand_name);
      }
    } catch (err) { console.error(err); }
  };

  const handleSaveCustomBrandName = async () => {
    if (!customBrandName.trim()) return alert('กรุณาระบุชื่อแบรนด์');
    setSavingCustomName(true);
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}/brand-name`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_name: customBrandName.trim() })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert('บันทึกชื่อแบรนด์สำเร็จ!');
      } else {
        alert(data.message);
      }
    } catch (err) {
      alert('เชื่อมต่อ Server ไม่ได้');
    } finally {
      setSavingCustomName(false);
    }
  };

  const selectedNameObj = namesList.find(n => n.is_selected);
  const otherNames      = namesList.filter(n => !n.is_selected);

  // ─────────────────────────────────────────────────────────
  // NEW: COLOR & FONT STATE  (added, not touching name logic)
  // ─────────────────────────────────────────────────────────

  /* shared dropdown for Color/Font modals */
  const [cncptOpenDd,  setCncptOpenDd]  = useState('');
  const [cncptOpenFd,  setCncptOpenFd]  = useState('');

  /* close filter-dropdowns on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.cncpt-cc-dd'))    setCncptOpenDd('');
      if (!e.target.closest('.cncpt-filter-dd')) setCncptOpenFd('');
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* Color modal state */
  const [colorModal,          setColorModal]          = useState(false);
  const [cncptColorProduct,   setCncptColorProduct]   = useState('');
  const [cncptColorCat,       setCncptColorCat]       = useState('');
  const [cncptColorToneTags,  setCncptColorToneTags]  = useState([]);
  const [cncptColorMoodTags,  setCncptColorMoodTags]  = useState([]);
  const [cncptColorTarget,    setCncptColorTarget]    = useState('');
  const [cncptColorErrors,    setCncptColorErrors]    = useState({});
  const [cncptColorPool,      setCncptColorPool]      = useState([]);
  const [cncptColorFiltered,  setCncptColorFiltered]  = useState([]);
  const [cncptColorShown,     setCncptColorShown]     = useState(0);
  const [cncptActiveTone,     setCncptActiveTone]     = useState('');
  const [cncptActiveMood,     setCncptActiveMood]     = useState('');
  const [cncptActiveBiz,      setCncptActiveBiz]      = useState('');
  const [cncptColorResult,    setCncptColorResult]    = useState(false);
  const [cncptSelectedPalette,setCncptSelectedPalette]= useState('');
  const [cncptFavPalettes,    setCncptFavPalettes]    = useState(new Set());
  const [cncptShowFavOnly,    setCncptShowFavOnly]    = useState(false);
  const [cncptDbPalettes,     setCncptDbPalettes]     = useState([]); // palette ที่ save แล้วใน DB (มี color_id)
  const [cncptDbMap,          setCncptDbMap]          = useState({}); // lookup map: name_palette → { color_id, concept_id, is_liked, is_selected }

  /* Font modal state */
  const [fontsModal,           setFontsModal]           = useState(false);
  const [cncptFontProduct,     setCncptFontProduct]     = useState('');
  const [cncptFontCat,         setCncptFontCat]         = useState('');
  const [cncptFontStyleTags,   setCncptFontStyleTags]   = useState([]);
  const [cncptFontMoodTags,    setCncptFontMoodTags]    = useState([]);
  const [cncptFontLangTag,     setCncptFontLangTag]     = useState('');
  const [cncptFontErrors,      setCncptFontErrors]      = useState({});
  const [cncptFontPool,        setCncptFontPool]        = useState([]);
  const [cncptFontsFiltered,   setCncptFontsFiltered]   = useState([]);
  const [cncptFontsShown,      setCncptFontsShown]      = useState(0);
  const [cncptTypeFilter,      setCncptTypeFilter]      = useState('');
  const [cncptThaiFilter,      setCncptThaiFilter]      = useState('');
  const [cncptFontMoodFilter,  setCncptFontMoodFilter]  = useState('');
  const [cncptFontSearch,      setCncptFontSearch]      = useState('');
  const [cncptFontResult,      setCncptFontResult]      = useState(false);
  const [cncptFeaturedIdx,     setCncptFeaturedIdx]     = useState(0);
  const [cncptSelectedFont,    setCncptSelectedFont]    = useState(-1);
  const [cncptFavFonts,        setCncptFavFonts]        = useState(new Set());
  const [cncptRawFonts,        setCncptRawFonts]        = useState([]);
  const [cncptDbFontMap,       setCncptDbFontMap]       = useState({}); // lookup: font_name → { font_id, concept_id, is_liked, is_selected }
  const [cncptSelectedFontName,setCncptSelectedFontName]= useState(''); // font_name ที่ selected
  const [cncptFontRefreshSpin, setCncptFontRefreshSpin] = useState(false);

  const cncptColorPageSize = 20;
  const cncptFontPageSize  = 20;

  /* ── toggle helpers ── */
  function cncptToggleTag(arr, setArr, val) {
    setArr(prev => prev.includes(val) ? prev.filter(t=>t!==val) : [...prev, val]);
  }
  function cncptToggleTagMax(arr, setArr, val, max) {
    if (!arr.includes(val) && arr.length >= max) return false;
    cncptToggleTag(arr, setArr, val);
    return true;
  }

  /* ── COLOR SUBMIT ── */
  async function cncptSubmitColor() {
    const errs = {};
    if (!cncptColorProduct.trim()) errs.product = true;
    if (Object.keys(errs).length) { setCncptColorErrors(errs); return; }
    setCncptColorErrors({});
    setColorModal(false);

    const moodsEN = cncptColorMoodTags.map(m=>CNCPT_MOOD_TH2EN_COLOR[m]||m);
    const tonesEN = cncptColorToneTags.map(t=>CNCPT_TONE_TH2EN[t]||t);
    const biz     = cncptColorCat;

    setLoading({ show: true, text: 'กำลัง Generate Palette...' });
    setCncptActiveMood(moodsEN[0]||'');
    setCncptActiveTone(tonesEN[0]||'');
    setCncptActiveBiz(biz);

    let pool;
    try {
      pool = await cncptGenerateColorPool(moodsEN, tonesEN, biz);
    } catch(err) {
      console.error('[ColorAPI]', err);
      pool = CNCPT_PALETTE_LIBRARY.map(p=>({...p, source:'dataset'}));
    }

    setCncptColorPool(pool);
    const filtered = cncptApplyColorFilters(pool, tonesEN[0]||'', moodsEN[0]||'', biz, false, new Set());
    setCncptColorFiltered(filtered);
    setCncptColorShown(Math.min(cncptColorPageSize, filtered.length));
    setCncptColorResult(true);

    setLoading({ show: false, text: '' });
  }

  function cncptApplyColorFilters(pool, toneEN, moodEN, biz, favOnly, favSet) {
    let r = [...pool];
    if (moodEN) r = r.filter(p=>p.mood===moodEN);
    if (toneEN) r = r.filter(p=>p.tones&&p.tones.includes(toneEN));
    if (biz)    r = r.filter(p=>p.biz===biz);
    if (favOnly && favSet && favSet.size>0) r = r.filter(p=>favSet.has(p.name));
    const seen = new Set();
    return r.filter(p=>{ if(seen.has(p.name)) return false; seen.add(p.name); return true; });
  }

  function cncptApplyColorFilterUI(type, valueTH, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    const valueEN = type==='tone'? (CNCPT_TONE_TH2EN[valueTH]||'')
                  : type==='mood'? (CNCPT_MOOD_TH2EN_COLOR[valueTH]||'')
                  : valueTH;
    let tone = cncptActiveTone, mood = cncptActiveMood, biz = cncptActiveBiz;
    if (type==='tone') tone = valueEN;
    if (type==='mood') mood = valueEN;
    if (type==='biz')  biz  = (valueTH===CNCPT_COLOR_CATS.biz.all?'':valueTH);
    setCncptActiveTone(tone); setCncptActiveMood(mood); setCncptActiveBiz(biz);
    setCncptOpenFd('');
    const filtered = cncptApplyColorFilters(cncptColorPool, tone, mood, biz, cncptShowFavOnly, cncptFavPalettes);
    setCncptColorFiltered(filtered);
    setCncptColorShown(Math.min(cncptColorPageSize, filtered.length));
  }

  function cncptToggleFavOnly() {
    const next = !cncptShowFavOnly;
    setCncptShowFavOnly(next);
    const filtered = cncptApplyColorFilters(cncptColorPool, cncptActiveTone, cncptActiveMood, cncptActiveBiz, next, cncptFavPalettes);
    setCncptColorFiltered(filtered);
    setCncptColorShown(Math.min(cncptColorPageSize, filtered.length));
  }

  function cncptResetColorFilters() {
    setCncptActiveTone(''); setCncptActiveMood(''); setCncptActiveBiz(''); setCncptShowFavOnly(false);
    const filtered = cncptApplyColorFilters(cncptColorPool,'','','',false,cncptFavPalettes);
    setCncptColorFiltered(filtered);
    setCncptColorShown(Math.min(cncptColorPageSize, filtered.length));
  }

  function cncptCopyHex(hex) {
    navigator.clipboard?.writeText(hex).catch(()=>{});
  }

  /* ── FONT SUBMIT ── */
  async function cncptSubmitFonts() {
    const errs = {};
    if (!cncptFontProduct.trim()) errs.product = true;
    if (!cncptFontLangTag)        errs.lang    = true;
    if (Object.keys(errs).length) { setCncptFontErrors(errs); return; }
    setCncptFontErrors({});
    setFontsModal(false);

    const MOOD_TH2EN_FONT = Object.fromEntries(Object.entries(CNCPT_MOOD_LABELS).map(([en,th])=>[th,en]));
    const moodsEN    = cncptFontMoodTags.map(m=>MOOD_TH2EN_FONT[m]||'').filter(Boolean);
    const initTypeEN = cncptFontStyleTags.length ? (CNCPT_STYLE_TH2EN[cncptFontStyleTags[0]]||'') : '';
    const wantThai   = cncptFontLangTag.includes('ใช่');

    setCncptTypeFilter(initTypeEN);
    setCncptThaiFilter(wantThai?'th':'');
    setCncptFontMoodFilter(moodsEN[0]||'');

    setLoading({ show: true, text: 'กำลังดึงข้อมูล Font...' });

    // inject @font-face สำหรับ local fonts
    cncptInjectLocalFontFaces();

    const googleFonts = await cncptFetchGoogleFonts();

    // รวม local fonts (ขึ้นก่อน) + Google Fonts
    const pool = [...CNCPT_LOCAL_FONTS, ...googleFonts];
    setCncptFontPool(pool);
    const filtered = cncptApplyFontFilters(pool, initTypeEN, wantThai?'th':'', moodsEN[0]||'');
    setCncptFontsFiltered(filtered);
    setCncptFontsShown(Math.min(cncptFontPageSize, filtered.length));
    setCncptFontResult(true);
    setCncptFeaturedIdx(0);
    cncptLoadGoogleFont(filtered[0]);
    setLoading({ show: false, text: '' });
  }

  function cncptApplyFontFilters(pool, typeEN, thaiFilter, moodFilter) {
    let r = [...pool];
    if (thaiFilter==='th') r = r.filter(f=>f.thai);
    if (thaiFilter==='en') r = r.filter(f=>!f.thai);
    if (typeEN)            r = r.filter(f=>f.type===typeEN);
    if (moodFilter)        r = r.filter(f=>f.moods&&f.moods.includes(moodFilter));
    // local fonts ขึ้นก่อนเสมอ
    r.sort((a,b) => (a.local===b.local ? 0 : a.local ? -1 : 1));
    return r;
  }

  function cncptApplyFontFilterUI(type, valueTH, e) {
    if (e) e.stopPropagation();
    setCncptOpenFd('');
    let type_ = cncptTypeFilter, thai_ = cncptThaiFilter, mood_ = cncptFontMoodFilter;
    if (type==='family') type_ = CNCPT_STYLE_TH2EN[valueTH]||'';
    if (type==='thai')   thai_ = valueTH;
    if (type==='mood')   mood_ = valueTH;
    setCncptTypeFilter(type_); setCncptThaiFilter(thai_); setCncptFontMoodFilter(mood_);
    setCncptFontSearch('');
    const filtered = cncptApplyFontFilters(cncptFontPool, type_, thai_, mood_);
    setCncptFontsFiltered(filtered);
    setCncptFontsShown(Math.min(cncptFontPageSize, filtered.length));
    setCncptFeaturedIdx(0);
    cncptLoadGoogleFont(filtered[0]);
  }

  function cncptResetFontFilters() {
    setCncptTypeFilter(''); setCncptThaiFilter(''); setCncptFontMoodFilter(''); setCncptFontSearch('');
    const filtered = cncptApplyFontFilters(cncptFontPool,'','','');
    setCncptFontsFiltered(filtered);
    setCncptFontsShown(Math.min(cncptFontPageSize, filtered.length));
  }

  function cncptLoadGoogleFont(f) {
    if (!f || f.local) return;
    const id = `cncpt-gf-${f.gf}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id; link.rel='stylesheet';
      link.href=`https://fonts.googleapis.com/css2?family=${f.gf}:wght@400;700&display=swap`;
      document.head.appendChild(link);
    }
  }

  function cncptRefreshFeatured() {
    if (!cncptFontsFiltered.length) return;
    setCncptFontRefreshSpin(true);
    const next = (cncptFeaturedIdx+1) % Math.min(cncptFontsFiltered.length,50);
    setCncptFeaturedIdx(next);
    cncptLoadGoogleFont(cncptFontsFiltered[next]);
    setTimeout(()=>setCncptFontRefreshSpin(false), 600);
  }

  /* derived values */
  const cncptVisiblePalettes = cncptColorFiltered.slice(0, cncptColorShown);
  const cncptSearchedFonts   = cncptFontSearch
    ? cncptFontsFiltered.filter(f=>f.name.toLowerCase().includes(cncptFontSearch.toLowerCase()))
    : cncptFontsFiltered.slice(0, cncptFontsShown);
  const cncptFeaturedFont = cncptFontsFiltered[cncptFeaturedIdx];

  useEffect(()=>{ if(cncptFeaturedFont) cncptLoadGoogleFont(cncptFeaturedFont); },[cncptFeaturedIdx]);

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────
  return (
    <div className="cncpt-body">
      <header className="cncpt-navbar">
        <div className="cncpt-logo"><Link to="/"><img src={logoImg} alt="logo" className="cncpt-logo-img" /></Link></div>
        <div className="cncpt-nav-icons">
          <button className="cncpt-btn-world"><iconify-icon icon="iconamoon:search-light"></iconify-icon></button>
          <NotificationBell className="cncpt-btn-world" />
          <NavProfileButton className="cncpt-btn-users" />
        </div>
      </header>

      {/* Ambient orbs (identical to BrandDNA) */}
      <div className="cncpt-orb3"></div>
      <div className="cncpt-orb4"></div>

      <div className="cncpt-container">
        {/* ── SIDEBAR ── */}
        <ConceptSidebarNews activePage="create-concept" projectId={projectId} />

        {/* ── MAIN CONTENT ── */}
        <main className="cncpt-main-content">
          {/* TAB BAR — now includes Color & Fonts */}
          <div className="cncpt-tab-bar">
            <button className={`cncpt-tab ${activeTab === 'name'  ? 'cncpt-active' : ''}`} onClick={() => setActiveTab('name')}>Name</button>
            <button className={`cncpt-tab ${activeTab === 'color' ? 'cncpt-active' : ''}`} onClick={() => setActiveTab('color')}>Color</button>
            <button className={`cncpt-tab ${activeTab === 'fonts' ? 'cncpt-active' : ''}`} onClick={() => setActiveTab('fonts')}>Fonts</button>
          </div>

          {/* ════════════════════════════════════
              TAB 1: NAME  (original, unchanged)
              ════════════════════════════════════ */}
          <div className="cncpt-tab-content" style={{ display: activeTab === 'name' ? 'flex' : 'none' }}>
            {/* ช่องตั้งชื่อแบรนด์ด้วยตัวเอง */}
            <div className="cncpt-name-input-card">
              <p>
                <iconify-icon icon="mdi:pencil-outline"></iconify-icon>
                ชื่อแบรนด์ของคุณ
              </p>
              <div className="cncpt-name-input-row">
                <input
                  type="text"
                  className="cncpt-name-input"
                  placeholder="พิมพ์ชื่อแบรนด์ที่ต้องการ..."
                  value={customBrandName}
                  onChange={(e) => setCustomBrandName(e.target.value)}
                />
                <button
                  className="cncpt-name-save-btn"
                  onClick={handleSaveCustomBrandName}
                  disabled={savingCustomName}
                >
                  {savingCustomName ? 'กำลังบันทึก...' : 'บันทึกชื่อ'}
                </button>
              </div>
              <p className="cncpt-name-hint">ชื่อนี้จะถูกใช้ในการสร้างโลโก้และคอนเทนต์ต่างๆ</p>
            </div>

            {namesList.length === 0 ? (
              <div className="cncpt-empty-state">
                <div className="cncpt-empty-icon"><iconify-icon icon="mdi:pencil-box-outline"></iconify-icon></div>
                <p className="cncpt-empty-title">หรือให้ AI ช่วยคิดชื่อแบรนด์ให้คุณ</p>
                <button className="cncpt-get-start-btn" onClick={() => openModal('name')}>ให้ AI คิดชื่อ</button>
              </div>
            ) : (
              <div style={{ width: '100%' }}>
                {selectedNameObj && (
                  <div className="cncpt-selected-name-card">
                    <p className="cncpt-result-label">ชื่อที่คุณเลือกใช้สำหรับโปรเจกต์นี้</p>
                    <h2 className="cncpt-result-name">{customBrandName || selectedNameObj.brand_name}</h2>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ color: 'var(--charcoal)', fontWeight: 700 }}>รายชื่อที่ AI แนะนำ</h3>
                  <button className="cncpt-rename-btn" onClick={() => openModal('name')}>
                    ให้ AI คิดให้อีกครั้ง <iconify-icon icon="mdi:refresh"></iconify-icon>
                  </button>
                </div>
                <div className="cncpt-names-grid">
                  {otherNames.map((n) => (
                    <div key={n.concept_id} className="cncpt-name-card">
                      <button
                        className={`cncpt-name-card-like${n.is_liked ? ' liked' : ''}`}
                        onClick={() => handleLike(n.concept_id, n.is_liked)}
                      >
                        <iconify-icon icon={n.is_liked ? "mdi:heart" : "mdi:heart-outline"}></iconify-icon>
                      </button>
                      <h3>{n.brand_name}</h3>
                      <button
                        onClick={() => handleSelect(n.concept_id)}
                        className="cncpt-select-btn"
                      >
                        <iconify-icon icon="mdi:check-circle-outline"></iconify-icon> เลือกชื่อนี้
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════
              TAB 2: COLOR  (new)
              ════════════════════════════════════ */}
          {activeTab === 'color' && (
            <div className="cncpt-tab-content">
                <div style={{width:'100%'}}>
                  {/* Filter bar */}
                  <div className="cncpt-filter-bar">
                    {/* Tone */}
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-tone'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-tone'?'':'cncpt-fd-tone');}}>
                      <CncptIcon icon="mdi:palette-outline"/>
                      <span style={cncptActiveTone?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptActiveTone ? CNCPT_EN2TH_TONE[cncptActiveTone]||cncptActiveTone : 'โทนสี'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyColorFilterUI('tone','',e)}>ทุกโทนสี</li>
                        {CNCPT_COLOR_CATS.tone.items.map(i=>(
                          <li key={i.value} onClick={e=>cncptApplyColorFilterUI('tone',i.value,e)}>{i.value}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Mood */}
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-mood2'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-mood2'?'':'cncpt-fd-mood2');}}>
                      <CncptIcon icon="mdi:emoticon-outline"/>
                      <span style={cncptActiveMood?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptActiveMood ? CNCPT_EN2TH_MOOD[cncptActiveMood]||cncptActiveMood : 'อารมณ์แบรนด์'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyColorFilterUI('mood','',e)}>ทุกอารมณ์</li>
                        {CNCPT_COLOR_CATS.mood.items.map(i=>(
                          <li key={i.value} onClick={e=>cncptApplyColorFilterUI('mood',i.value,e)}>{i.value}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Biz */}
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-biz'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-biz'?'':'cncpt-fd-biz');}}>
                      <CncptIcon icon="mdi:briefcase-outline"/>
                      <span style={cncptActiveBiz?{color:'#D35325',fontWeight:700}:{}}>{cncptActiveBiz||'ประเภทธุรกิจ'}</span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyColorFilterUI('biz',CNCPT_COLOR_CATS.biz.all,e)}>ทุกประเภทธุรกิจ</li>
                        {CNCPT_COLOR_CATS.biz.items.map(i=>(
                          <li key={i.value} onClick={e=>cncptApplyColorFilterUI('biz',i.value,e)}>{i.value}</li>
                        ))}
                      </ul>
                    </div>
                    {/* Favorites dropdown */}
                    <div className={`cncpt-filter-dd cncpt-fav-dd${cncptOpenFd==='cncpt-fd-fav'?' cncpt-open':''}${cncptShowFavOnly?' cncpt-fav-active-dd':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-fav'?'':'cncpt-fd-fav');}}>
                      <CncptIcon icon={cncptShowFavOnly?'mdi:star':'mdi:star-outline'}/>
                      <span style={cncptShowFavOnly?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptShowFavOnly?`Favorites (${cncptFavPalettes.size})`:'Favorites'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>{e.stopPropagation();e.preventDefault();cncptToggleFavOnly();}}>
                          {cncptShowFavOnly?'✓ แสดงทั้งหมด':'★ แสดงเฉพาะที่กดใจ'}
                        </li>
                        {cncptFavPalettes.size===0 && (
                          <li style={{color:'#aaa',cursor:'default',fontStyle:'italic'}}>ยังไม่มี Favorite</li>
                        )}
                        {[...cncptFavPalettes].map(name=>{
                          const pal = CNCPT_PALETTE_LIBRARY.find(p=>p.name===name) || cncptColorPool.find(p=>p.name===name);
                          return (
                            <li key={name} style={{display:'flex',alignItems:'center',gap:8}}
                              onClick={e=>{e.stopPropagation();e.preventDefault();}}>
                              {pal && pal.colors.slice(0,3).map((c,i)=>(
                                <span key={i} style={{width:12,height:12,borderRadius:'50%',background:c,display:'inline-block',flexShrink:0}}/>
                              ))}
                              <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
                              <span style={{color:'#bbb',cursor:'pointer',marginLeft:4}}
                                onClick={ev=>{ev.stopPropagation();setCncptFavPalettes(prev=>{const s=new Set(prev);s.delete(name);
                                  if(cncptShowFavOnly){const f=cncptApplyColorFilters(cncptColorPool,cncptActiveTone,cncptActiveMood,cncptActiveBiz,true,s);setCncptColorFiltered(f);setCncptColorShown(Math.min(cncptColorPageSize,f.length));}
                                  return s;
                                });}}>✕</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <span className="cncpt-font-count-badge">{cncptColorFiltered.length} palettes</span>
                    <button className="cncpt-rename-btn" style={{marginLeft:'auto'}} onClick={()=>{setColorModal(true);setCncptShowFavOnly(false);}}>
                      <CncptIcon icon="mdi:palette-outline"/> Generate Palette
                    </button>
                  </div>

                  {/* Palette grid */}
                  {cncptColorPool.length === 0 ? (
                    <div className="cncpt-empty-state">
                      <div className="cncpt-empty-icon"><CncptIcon icon="mdi:palette-outline"/></div>
                      <p className="cncpt-empty-title">Find the perfect color palette for your brand.</p>
                      <button className="cncpt-get-start-btn" onClick={() => setColorModal(true)}>Generate Palette</button>
                    </div>
                  ) : cncptColorFiltered.length === 0 ? (
                    <div className="cncpt-filter-empty-state">
                      <div className="cncpt-filter-empty-icon"><CncptIcon icon="mdi:filter-remove-outline" width="48"/></div>
                      <p className="cncpt-filter-empty-title">ไม่พบพาเลทที่ตรงกัน</p>
                      <p className="cncpt-filter-empty-desc">ลองปรับตัวกรองดูนะ</p>
                      <button className="cncpt-filter-reset-btn" onClick={cncptResetColorFilters}>
                        <CncptIcon icon="mdi:refresh"/> รีเซ็ตตัวกรองทั้งหมด
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="cncpt-palette-grid">
                        {cncptVisiblePalettes.map((p,idx)=>{
                          const tagsTH=[...new Set([cncptMoodTH(p.mood),...(p.tones||[]).map(cncptToneTH),...(p.biz?[p.biz]:[])])].filter(Boolean);
                          const isFav = cncptFavPalettes.has(p.name);
                          const isSelected = cncptSelectedPalette === p.name;
                          return (
                            <div key={p.name+idx} className={`cncpt-palette-card${isSelected?' cncpt-selected':''}`}>
                              <h3 className="cncpt-pc-name">{p.name}</h3>
                              <div className="cncpt-pc-tags">{tagsTH.map(t=><span key={t} className="cncpt-pc-tag">{t}</span>)}</div>
                              <div className="cncpt-pc-swatches-row">
                                {p.colors.map((hex,hi)=>(
                                  <div key={hex+hi} className="cncpt-swatch-item" style={{background:hex}}
                                    onClick={()=>cncptCopyHex(hex)} title={hex}>
                                    <span className="cncpt-swatch-hex" style={{color:cncptContrastColor(hex)}}>{hex}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="cncpt-pc-actions">
                                <button className={`cncpt-pc-fav-btn${isFav?' cncpt-faved':''}`}
                                  onClick={async ()=>{
                                    const newFav = !isFav;
                                    // อัปเดต UI ก่อนเลย
                                    setCncptFavPalettes(prev=>{
                                      const s=new Set(prev);
                                      if(s.has(p.name)) s.delete(p.name); else s.add(p.name);
                                      if(cncptShowFavOnly){
                                        const f=cncptApplyColorFilters(cncptColorPool,cncptActiveTone,cncptActiveMood,cncptActiveBiz,true,s);
                                        setCncptColorFiltered(f);
                                        setCncptColorShown(Math.min(cncptColorPageSize,f.length));
                                      }
                                      return s;
                                    });
                                    if (!projectId) return;
                                    try {
                                      // 1. save-one เพื่อให้มี color_id + concept_id ก่อน (ถ้ายังไม่มีใน DB)
                                      let dbEntry = cncptDbMap[p.name];
                                      if (!dbEntry?.color_id) {
                                        const saveRes = await fetch(`${API_URL}/api/color-palettes/save-one`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            project_id: projectId,
                                            name_palette: p.name,
                                            color_code_1: p.colors[0]||'',
                                            color_code_2: p.colors[1]||'',
                                            color_code_3: p.colors[2]||'',
                                            color_code_4: p.colors[3]||'',
                                            color_code_5: p.colors[4]||'',
                                          }),
                                        });
                                        const saveData = await saveRes.json();
                                        if (saveData.status === 'success') {
                                          dbEntry = { color_id: saveData.color_id, concept_id: saveData.concept_id, is_liked: false, is_selected: false };
                                          setCncptDbMap(prev => ({ ...prev, [p.name]: dbEntry }));
                                        }
                                      }
                                      // 2. กด like
                                      if (dbEntry?.color_id) {
                                        await fetch(`${API_URL}/api/color-palettes/like/${dbEntry.color_id}`, {
                                          method: 'PUT',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ is_liked: newFav, project_id: projectId })
                                        });
                                        setCncptDbMap(prev => ({
                                          ...prev,
                                          [p.name]: { ...prev[p.name], is_liked: newFav }
                                        }));
                                      }
                                    } catch(err) { console.error('like palette error:', err); }
                                  }}>
                                  <CncptIcon icon={isFav?'solar:heart-bold':'solar:heart-linear'}/>
                                </button>
                                <button className={`cncpt-pc-sel-btn${isSelected?' cncpt-selected':''}`} onClick={async ()=>{
                                  setCncptSelectedPalette(p.name);
                                  if (!projectId) return;
                                  try {
                                    // save-one เสมอ — ได้ color_id + concept_id จาก DB โดยตรง (ไม่ต้องพึ่ง state)
                                    const saveRes = await fetch(`${API_URL}/api/color-palettes/save-one`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        project_id: projectId,
                                        name_palette: p.name,
                                        color_code_1: p.colors[0]||'',
                                        color_code_2: p.colors[1]||'',
                                        color_code_3: p.colors[2]||'',
                                        color_code_4: p.colors[3]||'',
                                        color_code_5: p.colors[4]||'',
                                      }),
                                    });
                                    const saveData = await saveRes.json();
                                    console.log('[select] save-one result:', saveData);
                                    if (saveData.status !== 'success') {
                                      console.error('[select] save-one failed:', saveData);
                                      return;
                                    }
                                    const { color_id: freshColorId, concept_id: freshConceptId } = saveData;
                                    setCncptDbMap(prev => ({
                                      ...prev,
                                      [p.name]: { ...prev[p.name], color_id: freshColorId, concept_id: freshConceptId }
                                    }));

                                    // select — ส่ง color_id ตรงจาก save-one response (ไม่ผ่าน state ที่อาจ stale)
                                    console.log('[select] calling select API, concept_id:', freshConceptId, 'color_id:', freshColorId);
                                    const selRes = await fetch(`${API_URL}/api/color-palettes/select/${freshConceptId}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ project_id: projectId, color_id: freshColorId })
                                    });
                                    const selData = await selRes.json();
                                    console.log('[select] select result:', selData);
                                    setCncptDbMap(prev => {
                                      const next = {};
                                      Object.entries(prev).forEach(([k, v]) => {
                                        next[k] = { ...v, is_selected: k === p.name };
                                      });
                                      return next;
                                    });
                                  } catch(err) { console.error('[select] error:', err); }
                                }}>
                                  <CncptIcon icon="mdi:check-circle-outline"/> Select ›
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {cncptColorShown < cncptColorFiltered.length && (
                        <div className="cncpt-load-more-wrap">
                          <button className="cncpt-load-more-btn"
                            onClick={()=>setCncptColorShown(p=>Math.min(p+cncptColorPageSize,cncptColorFiltered.length))}>
                            <CncptIcon icon="mdi:chevron-down"/> ดูเพิ่มเติม
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
            </div>
          )}

          {/* ════════════════════════════════════
              TAB 3: FONTS  (new)
              ════════════════════════════════════ */}
          {activeTab === 'fonts' && (
            <div className="cncpt-tab-content">
                <div style={{width:'100%'}}>
                  {/* Filter bar */}
                  <div className="cncpt-filter-bar">
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-family'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-family'?'':'cncpt-fd-family');}}>
                      <CncptIcon icon="mdi:format-font"/>
                      <span style={cncptTypeFilter?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptTypeFilter ? Object.entries(CNCPT_STYLE_TH2EN).find(([,v])=>v===cncptTypeFilter)?.[0]||cncptTypeFilter : 'รูปแบบ Font'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyFontFilterUI('family','',e)}>ทุกรูปแบบ</li>
                        {Object.entries(CNCPT_STYLE_TH2EN).map(([th])=>(
                          <li key={th} onClick={e=>cncptApplyFontFilterUI('family',th,e)}>{th}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-thai'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-thai'?'':'cncpt-fd-thai');}}>
                      <CncptIcon icon="mdi:translate"/>
                      <span style={cncptThaiFilter?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptThaiFilter==='th'?'รองรับภาษาไทย':cncptThaiFilter==='en'?'รองรับภาษาอังกฤษ':'ภาษา'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyFontFilterUI('thai','',e)}>ทุกภาษา</li>
                        <li onClick={e=>cncptApplyFontFilterUI('thai','th',e)}>รองรับภาษาไทย</li>
                        <li onClick={e=>cncptApplyFontFilterUI('thai','en',e)}>รองรับภาษาอังกฤษ</li>
                      </ul>
                    </div>
                    <div className={`cncpt-filter-dd${cncptOpenFd==='cncpt-fd-fmood'?' cncpt-open':''}`}
                      onClick={e=>{e.stopPropagation();setCncptOpenFd(cncptOpenFd==='cncpt-fd-fmood'?'':'cncpt-fd-fmood');}}>
                      <CncptIcon icon="mdi:emoticon-outline"/>
                      <span style={cncptFontMoodFilter?{color:'#D35325',fontWeight:700}:{}}>
                        {cncptFontMoodFilter ? CNCPT_MOOD_LABELS[cncptFontMoodFilter]||cncptFontMoodFilter : 'อารมณ์ Font'}
                      </span>
                      <CncptIcon icon="mdi:chevron-down"/>
                      <ul className="cncpt-fd-menu">
                        <li onClick={e=>cncptApplyFontFilterUI('mood','',e)}>ทุกอารมณ์</li>
                        {Object.entries(CNCPT_MOOD_LABELS).map(([en,th])=>(
                          <li key={en} onClick={e=>cncptApplyFontFilterUI('mood',en,e)}>
                            <CncptIcon icon={CNCPT_MOOD_ICONS[en]||'mdi:tag'} width="16"/> {th}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <span className="cncpt-font-count-badge">{cncptFontsFiltered.length} fonts</span>
                    <div className="cncpt-search-wrap">
                      <CncptIcon icon="mdi:magnify"/>
                      <input type="text" placeholder="Search fonts name ..."
                        value={cncptFontSearch} onChange={e=>setCncptFontSearch(e.target.value)}/>
                    </div>
                    <button className="cncpt-rename-btn" style={{marginLeft:'auto'}} onClick={()=>setFontsModal(true)}>
                      <CncptIcon icon="mdi:tune-variant"/> ตัวช่วยเลือก Font
                    </button>
                  </div>

                  {/* Featured banner */}
                  {cncptFeaturedFont && cncptFontPool.length > 0 && (
                    <div className="cncpt-suggested-banner">
                      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
                        <button className="cncpt-suggested-pill">✦ Suggested for you</button>
                        <div className="cncpt-font-suggest-tags">
                          {cncptThaiFilter==='th'&&<span className="cncpt-ftag">Thai</span>}
                          {cncptFeaturedFont.moods?.map(m=>(
                            <span key={m} className="cncpt-ftag">{CNCPT_MOOD_LABELS[m]||m}</span>
                          ))}
                        </div>
                        <button className={`cncpt-refresh-btn${cncptFontRefreshSpin?' cncpt-spinning':''}`} onClick={cncptRefreshFeatured}>
                          <CncptIcon icon="mdi:refresh"/> Refresh
                        </button>
                      </div>
                      <div className="cncpt-featured-font-box">
                        <div>
                          <p className="cncpt-featured-font-name">{cncptFeaturedFont.name}</p>
                          <p className="cncpt-featured-font-big" style={{fontFamily:`'${cncptFeaturedFont.name}',sans-serif`}}>
                            Aa Bb Cc Dd Ee Ff Gg
                          </p>
                          {cncptFeaturedFont.thai && (
                            <p className="cncpt-featured-font-thai" style={{fontFamily:`'${cncptFeaturedFont.name}',sans-serif`}}>
                              ก ข ค ง จ ฉ ช
                            </p>
                          )}
                          <div className="cncpt-feat-mood-row">
                            {(cncptFeaturedFont.moods||[]).map(m=>(
                              <span key={m} className={`cncpt-mood-pill cncpt-mood-${m}`}>
                                <CncptIcon icon={CNCPT_MOOD_ICONS[m]||'mdi:tag'} width="13"/> {CNCPT_MOOD_LABELS[m]||m}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button className="cncpt-use-save-btn" onClick={async ()=>{
                          setCncptSelectedFont(0);
                          if (!cncptFeaturedFont || !projectId) return;
                          try {
                            const saveRes = await fetch(`${API_URL}/api/fonts/save-one`, {
                              method: 'POST', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ project_id: projectId, font_name: cncptFeaturedFont.name, file_font: cncptFeaturedFont.file||null }),
                            });
                            const saveData = await saveRes.json();
                            if (saveData.status !== 'success') return;
                            setCncptSelectedFontName(cncptFeaturedFont.name);
                            await fetch(`${API_URL}/api/fonts/select/${saveData.concept_id}`, {
                              method: 'PUT', headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ project_id: projectId }),
                            });
                          } catch(err) { console.error('use-save font error:', err); }
                        }}>Use &amp; Save ›</button>
                      </div>
                    </div>
                  )}

                  {/* Font grid / empty */}
                  {cncptFontPool.length === 0 ? (
                    <div className="cncpt-empty-state">
                      <div className="cncpt-empty-icon"><CncptIcon icon="mdi:format-font"/></div>
                      <p className="cncpt-empty-title">Find the perfect font for your brand.</p>
                      <button className="cncpt-get-start-btn" onClick={()=>setFontsModal(true)}>ตัวช่วยเลือก Font</button>
                    </div>
                  ) : cncptFontsFiltered.length === 0 ? (
                    <div className="cncpt-filter-empty-state">
                      <div className="cncpt-filter-empty-icon"><CncptIcon icon="mdi:filter-remove-outline" width="48"/></div>
                      <p className="cncpt-filter-empty-title">ไม่พบฟ้อนต์ที่ตรงกัน</p>
                      <p className="cncpt-filter-empty-desc">ลองปรับตัวกรองดูนะ</p>
                      <button className="cncpt-filter-reset-btn" onClick={cncptResetFontFilters}>
                        <CncptIcon icon="mdi:refresh"/> รีเซ็ตตัวกรองทั้งหมด
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="cncpt-font-grid">
                        {cncptSearchedFonts.map((f,idx)=>{
                          cncptLoadGoogleFont(f);
                          return (
                            <div key={f.name} className={`cncpt-font-card${cncptSelectedFontName===f.name?' cncpt-selected':''}`}>
                              <p className="cncpt-fc-name" style={{fontFamily:`'${f.name}',sans-serif`}}>{f.name}</p>
                              <p className="cncpt-fc-meta">{CNCPT_STYLE_LABEL[f.type]||f.type}</p>
                              <div className="cncpt-fc-moods">
                                {(f.moods||[]).map(m=>(
                                  <span key={m} className={`cncpt-mood-badge cncpt-mood-${m}`}>
                                    <CncptIcon icon={CNCPT_MOOD_ICONS[m]||'mdi:tag'} width="12"/> {CNCPT_MOOD_LABELS[m]||m}
                                  </span>
                                ))}
                              </div>
                              <p className="cncpt-fc-sample" style={{fontFamily:`'${f.name}',sans-serif`}}>Your Brand Should Look Great</p>
                              {f.thai && <p className="cncpt-fc-sample" style={{fontFamily:`'${f.name}',sans-serif`}}>แบรนด์ของคุณควรดูดีเสมอ</p>}
                              <p className="cncpt-fc-lang">{f.thai?'🇹🇭 รองรับภาษาไทย':'Latin'}</p>
                              <div className="cncpt-pc-actions">
                                <button className={`cncpt-pc-fav-btn${cncptFavFonts.has(f.name)?' cncpt-faved':''}`}
                                  onClick={async ()=>{
                                    const newFav = !cncptFavFonts.has(f.name);
                                    setCncptFavFonts(prev=>{const s=new Set(prev);newFav?s.add(f.name):s.delete(f.name);return s;});
                                    if (!projectId) return;
                                    try {
                                      // save-one ก่อนเสมอ เพื่อให้ได้ font_id + concept_id
                                      const saveRes = await fetch(`${API_URL}/api/fonts/save-one`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ project_id: projectId, font_name: f.name, file_font: f.file||null }),
                                      });
                                      const saveData = await saveRes.json();
                                      if (saveData.status !== 'success') return;
                                      setCncptDbFontMap(prev => ({ ...prev, [f.name]: { ...prev[f.name], font_id: saveData.font_id, concept_id: saveData.concept_id } }));
                                      await fetch(`${API_URL}/api/fonts/like/${saveData.font_id}`, {
                                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ is_liked: newFav, project_id: projectId }),
                                      });
                                    } catch(err) { console.error('like font error:', err); }
                                  }}>
                                  <CncptIcon icon={cncptFavFonts.has(f.name)?'solar:heart-bold':'solar:heart-linear'}/>
                                </button>
                                <button className={`cncpt-pc-sel-btn${cncptSelectedFontName===f.name?' cncpt-selected':''}`}
                                  onClick={async ()=>{
                                    setCncptSelectedFont(idx);
                                    setCncptSelectedFontName(f.name);
                                    if (!projectId) return;
                                    try {
                                      // save-one ก่อนเสมอ เพื่อได้ font_id + concept_id จาก DB โดยตรง
                                      const saveRes = await fetch(`${API_URL}/api/fonts/save-one`, {
                                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ project_id: projectId, font_name: f.name, file_font: f.file||null }),
                                      });
                                      const saveData = await saveRes.json();
                                      console.log('[font select] save-one:', saveData);
                                      if (saveData.status !== 'success') return;
                                      setCncptDbFontMap(prev => ({ ...prev, [f.name]: { ...prev[f.name], font_id: saveData.font_id, concept_id: saveData.concept_id } }));
                                      // select
                                      const selRes = await fetch(`${API_URL}/api/fonts/select/${saveData.concept_id}`, {
                                        method: 'PUT', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ project_id: projectId }),
                                      });
                                      const selData = await selRes.json();
                                      console.log('[font select] result:', selData);
                                      setCncptDbFontMap(prev => {
                                        const next = {};
                                        Object.entries(prev).forEach(([k,v]) => { next[k] = {...v, is_selected: k===f.name}; });
                                        return next;
                                      });
                                    } catch(err) { console.error('select font error:', err); }
                                  }}>
                                  <CncptIcon icon="mdi:check-circle-outline"/> เลือกฟอนต์นี้
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {!cncptFontSearch && cncptFontsShown < cncptFontsFiltered.length && (
                        <div className="cncpt-load-more-wrap">
                          <button className="cncpt-load-more-btn"
                            onClick={()=>setCncptFontsShown(p=>Math.min(p+cncptFontPageSize,cncptFontsFiltered.length))}>
                            <CncptIcon icon="mdi:chevron-down"/> ดูเพิ่มเติม
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
            </div>
          )}
        </main>
      </div>

      {/* ════════════════════════════════════
          NAME MODAL  (original, unchanged)
          ════════════════════════════════════ */}
      {modals.name && (
        <div className="cncpt-cc-modal" onClick={() => closeModal('name')}>
          <div className="cncpt-cc-modal-box" onClick={e => e.stopPropagation()}>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">1</span> สินค้าของคุณคืออะไร <span className="cncpt-req-star">*</span></label>
              <input type="text" placeholder="เช่น โดนัท" className={nmErrors.product ? 'cncpt-input-err' : ''} value={nmForm.product} onChange={e => { setNmForm({ ...nmForm, product: e.target.value }); setNmErrors({ ...nmErrors, product: false }) }} />
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">2</span> ประเภท <span className="cncpt-req-star">*</span></label>
              <div className={`cncpt-cc-dd ${activeDropdown === 'dd-nm-cat' ? 'cncpt-open' : ''}`} onClick={(e) => handleDropdownClick(e, 'dd-nm-cat')}>
                <div className="cncpt-cc-dd-sel">
                  <span className={nmForm.cat ? '' : 'cncpt-dd-placeholder'}>{nmForm.cat || '-- เลือกประเภทสินค้า --'}</span>
                  <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                </div>
                <ul className="cncpt-cc-dd-list">
                  {['อาหาร / ของกินเล่น', 'เครื่องดื่ม', 'เสื้อผ้า', 'ความงาม', 'ของใช้'].map(c => (
                    <li key={c} onClick={() => { setNmForm({ ...nmForm, cat: c }); setNmErrors({ ...nmErrors, cat: false }) }}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">3</span> ประโยชน์และคุณค่าที่โดดเด่น</label>
              <input type="text" placeholder="เช่น สรรพคุณ ช่วยเรื่องอะไร" value={nmForm.benefit} onChange={e => setNmForm({ ...nmForm, benefit: e.target.value })} />
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">4</span> กลุ่มเป้าหมาย <span className="cncpt-req-star">{useDna ? '' : '*'}</span></label>
              {!useDna && (
                <div className={`cncpt-cc-dd ${activeDropdown === 'dd-nm-target' ? 'cncpt-open' : ''}`} onClick={(e) => handleDropdownClick(e, 'dd-nm-target')}>
                  <div className="cncpt-cc-dd-sel">
                    <span className={nmForm.target ? '' : 'cncpt-dd-placeholder'}>{nmForm.target || '-- เลือกกลุ่มเป้าหมาย --'}</span>
                    <iconify-icon icon="mdi:chevron-down"></iconify-icon>
                  </div>
                  <ul className="cncpt-cc-dd-list">
                    {['เด็ก', 'วัยรุ่น', 'วัยทำงาน', 'ผู้สูงอายุ', 'ทุกเพศทุกวัย'].map(c => (
                      <li key={c} onClick={() => { setNmForm({ ...nmForm, target: c }); setNmErrors({ ...nmErrors, target: false }) }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="cncpt-cb-label" style={{ marginTop: '15px' }}>
                <input type="checkbox" checked={useDna} onChange={(e) => { setUseDna(e.target.checked); setNmErrors({ ...nmErrors, target: false }); }} style={{ marginRight: '8px' }} />
                เลือกคำตอบจาก Brand DNA แทน
              </label>
              <p className="cncpt-dna-hint">คิดไม่ออกหรอ? <Link to="/brand-dna" state={{ projectId }}>Brand DNA ›</Link></p>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">5</span> รายละเอียดที่ต้องการ (เลือกได้หลายข้อ) <span className="cncpt-req-star">*</span></label>
              <div className="cncpt-tag-group">
                {['ชื่อไทย', 'ชื่ออังกฤษ', 'ชื่อทันสมัย', 'ชื่อคลาสสิค', 'มงคล', 'เน้นสื่อถึงสินค้า', 'เน้นสื่อถึงประโยชน์และคุณค่า'].map(t => (
                  <span key={t} className={`cncpt-tag ${nmForm.tags.includes(t) ? 'cncpt-active' : ''}`} onClick={() => toggleNmTag(t)}>{t}</span>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">6</span> ลักษณะชื่อที่ต้องการเป็นพิเศษ (ถ้ามี)</label>
              <textarea rows="3" placeholder="ระบุลักษณะพิเศษ..." value={nmForm.special} onChange={e => setNmForm({ ...nmForm, special: e.target.value })}></textarea>
            </div>

            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={() => closeModal('name')}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={submitName}>ให้ AI ช่วยคิดชื่อ</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          COLOR MODAL  (new)
          ════════════════════════════════════ */}
      {colorModal && (
        <div className="cncpt-cc-modal" onClick={() => { setColorModal(false); setCncptColorErrors({}); }}>
          <div className="cncpt-cc-modal-box" onClick={e => e.stopPropagation()}>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">1</span> สินค้าของคุณคืออะไร <span className="cncpt-req-star">*</span></label>
              <input type="text" value={cncptColorProduct} onChange={e=>setCncptColorProduct(e.target.value)}
                placeholder="เช่น โดนัท" className={cncptColorErrors.product?'cncpt-input-err':''}/>
              {cncptColorErrors.product && <p className="cncpt-err-msg cncpt-show">กรุณากรอกสินค้าของคุณ</p>}
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">2</span> ประเภทธุรกิจ</label>
              <CncptDropdown id="cncpt-dd-cl-cat" value={cncptColorCat} placeholder="-- เลือกประเภทธุรกิจ --"
                options={['อาหาร / ของกินเล่น','เครื่องดื่ม','เสื้อผ้า','ความงาม','เทคโนโลยี']}
                onSelect={setCncptColorCat} openDd={cncptOpenDd} setOpenDd={setCncptOpenDd}/>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">3</span> โทนสีที่ต้องการ <span className="cncpt-opt-label">(เลือกได้สูงสุด 2)</span></label>
              <div className="cncpt-tag-group">
                {CNCPT_COLOR_CATS.tone.items.map(i=>(
                  <CncptTag key={i.value} active={cncptColorToneTags.includes(i.value)}
                    onClick={()=>cncptToggleTagMax(cncptColorToneTags,setCncptColorToneTags,i.value,2)}>{i.value}</CncptTag>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">4</span> อารมณ์และบุคลิกแบรนด์ <span className="cncpt-opt-label">(เลือกได้สูงสุด 2)</span></label>
              <div className="cncpt-tag-group">
                {CNCPT_COLOR_CATS.mood.items.map(i=>(
                  <CncptTag key={i.value} active={cncptColorMoodTags.includes(i.value)}
                    onClick={()=>cncptToggleTagMax(cncptColorMoodTags,setCncptColorMoodTags,i.value,2)}>{i.value}</CncptTag>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">5</span> กลุ่มเป้าหมาย</label>
              <CncptDropdown id="cncpt-dd-cl-tg" value={cncptColorTarget} placeholder="-- เลือกกลุ่มเป้าหมาย --"
                options={['เด็ก','วัยรุ่น','วัยทำงาน','ผู้สูงอายุ','ทุกเพศทุกวัย']}
                onSelect={setCncptColorTarget} openDd={cncptOpenDd} setOpenDd={setCncptOpenDd}/>
            </div>

            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={() => { setColorModal(false); setCncptColorErrors({}); }}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={cncptSubmitColor}>ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          FONTS MODAL  (new)
          ════════════════════════════════════ */}
      {fontsModal && (
        <div className="cncpt-cc-modal" onClick={() => { setFontsModal(false); setCncptFontErrors({}); }}>
          <div className="cncpt-cc-modal-box" onClick={e => e.stopPropagation()}>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">1</span> สินค้าของคุณคืออะไร <span className="cncpt-req-star">*</span></label>
              <input type="text" value={cncptFontProduct} onChange={e=>setCncptFontProduct(e.target.value)}
                placeholder="เช่น โดนัท" className={cncptFontErrors.product?'cncpt-input-err':''}/>
              {cncptFontErrors.product && <p className="cncpt-err-msg cncpt-show">กรุณากรอกสินค้าของคุณ</p>}
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">2</span> ประเภทธุรกิจ</label>
              <CncptDropdown id="cncpt-dd-ft-cat" value={cncptFontCat} placeholder="-- เลือกประเภทธุรกิจ --"
                options={['อาหาร / ของกินเล่น','เครื่องดื่ม','เสื้อผ้า','ความงาม','เทคโนโลยี']}
                onSelect={setCncptFontCat} openDd={cncptOpenDd} setOpenDd={setCncptOpenDd}/>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">3</span> รูปแบบ Font ที่ต้องการ <span className="cncpt-opt-label">(เลือกได้สูงสุด 2)</span></label>
              <div className="cncpt-tag-group">
                {Object.keys(CNCPT_STYLE_TH2EN).map(th=>(
                  <CncptTag key={th} active={cncptFontStyleTags.includes(th)}
                    onClick={()=>cncptToggleTagMax(cncptFontStyleTags,setCncptFontStyleTags,th,2)}>{th}</CncptTag>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">4</span> อารมณ์ / Mood ที่ต้องการ <span className="cncpt-opt-label">(เลือกได้สูงสุด 2)</span></label>
              <p className="cncpt-mood-hint">เลือกอารมณ์ที่ตรงกับแบรนด์ของคุณ</p>
              <div className="cncpt-tag-group">
                {Object.entries(CNCPT_MOOD_LABELS).map(([en,th])=>(
                  <CncptTag key={en} active={cncptFontMoodTags.includes(th)}
                    onClick={()=>cncptToggleTagMax(cncptFontMoodTags,setCncptFontMoodTags,th,2)}>
                    <CncptIcon icon={CNCPT_MOOD_ICONS[en]} width="15"/> {th}
                  </CncptTag>
                ))}
              </div>
            </div>

            <div className="cncpt-form-group">
              <label><span className="cncpt-step">5</span> ต้องการรองรับภาษาไทยหรือไม่? <span className="cncpt-req-star">*</span></label>
              <div className="cncpt-tag-group">
                {['ใช่ (ต้องการภาษาไทย)','ไม่จำเป็น'].map(t=>(
                  <CncptTag key={t} active={cncptFontLangTag===t} onClick={()=>setCncptFontLangTag(t)}>{t}</CncptTag>
                ))}
              </div>
              {cncptFontErrors.lang && <p className="cncpt-err-msg cncpt-show">กรุณาเลือกตัวเลือก</p>}
            </div>

            <div className="cncpt-modal-actions">
              <button className="cncpt-cancel-btn" onClick={() => { setFontsModal(false); setCncptFontErrors({}); }}>ยกเลิก</button>
              <button className="cncpt-confirm-btn" onClick={cncptSubmitFonts}>ตกลง</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════
          LOADING OVERLAY  (original, unchanged)
          ════════════════════════════════════ */}
      {loading.show && (
        <div className="cncpt-loading-overlay">
          <div className="cncpt-loading-box">
            <div className="cncpt-spinner"></div>
            <p id="cncpt-loading-text">{loading.text}</p>
          </div>
        </div>
      )}
    </div>
  );
};