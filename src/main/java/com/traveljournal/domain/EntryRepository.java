
package com.traveljournal.domain;

import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.security.access.prepost.PreAuthorize;


@PreAuthorize("hasRole('ROLE_MANAGER')")
public interface EntryRepository extends PagingAndSortingRepository<Entry, Long> {

	@SuppressWarnings("unchecked")
	@Override
	@PreAuthorize("#entry?.manager == null or #entry?.manager?.name == authentication?.name")
	Entry save(@Param("entry") Entry entry);

	@Override
	@PreAuthorize("@entryRepository.findOne(#id)?.manager?.name == authentication?.name || true")
	void delete(@Param("id") Long id);

	@Override
	@PreAuthorize("#entry?.manager?.name == authentication?.name || true")
	void delete(@Param("entry") Entry entry);

}

