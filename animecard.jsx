import  from 'react';

const AnimeCard = ({ anime, onClick, index = 0 }) => (
  <div 
    onClick={() => onClick(anime.id)} 
    style={{ animationDelay: `${index * 40}ms` }} 
    className="Reactrelative flex-shrink-0 w-36 sm:w-44 md:w-48 group cursor-pointer transition-all duration-300 hover:-translate-y-2 animate-slide-up-fade"
  >
    <div className="aspect-[2/3] overflow-hidden rounded-lg shadow-lg relative bg-gray-900">
      <img 
        src={anime.poster} 
        alt={anime.name} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        loading="lazy" 
      />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold uppercase w-fit">
          {anime.type}
        </span>
      </div>
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        {anime.episodes?.sub > 0 && (
          <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-sm shadow-lg">SUB {anime.episodes.sub}</span>
        )}
      </div>
    </div>
    <h3 className="mt-3 text-sm font-bold text-gray-200 line-clamp-1 group-hover:text-blue-400 transition-colors">{anime.name}</h3>
    <p className="text-[11px] text-gray-500 line-clamp-1">{anime.jname || anime.type}</p>
  </div>
);

export default AnimeCard;
