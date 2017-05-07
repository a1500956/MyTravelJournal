
package com.traveljournal;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import com.traveljournal.domain.Entry;
import com.traveljournal.domain.EntryRepository;
import com.traveljournal.domain.Manager;
import com.traveljournal.domain.ManagerRepository;


@Component
public class DatabaseLoader implements CommandLineRunner {

	private final EntryRepository entries;
	private final ManagerRepository managers;

	@Autowired
	public DatabaseLoader(EntryRepository entryRepository,
						  ManagerRepository managerRepository) {

		this.entries = entryRepository;
		this.managers = managerRepository;
	}

	@Override
	public void run(String... strings) throws Exception {

		Manager Jukka = this.managers.save(new Manager("Jukka", "sVC~7^}f?G{2k%3R",
							"ROLE_MANAGER"));
		

		SecurityContextHolder.getContext().setAuthentication(
			new UsernamePasswordAuthenticationToken("Jukka", "doesn't matter",
				AuthorityUtils.createAuthorityList("ROLE_MANAGER")));

		this.entries.save(new Entry("Thailand", "2004-01-01", "What a great time we had! Lorem ipsum dolor sit amet, consectetur adipiscing elit.", Jukka));
		this.entries.save(new Entry("Nepal, Himalayas", "2012-02-15", "The beauty of these mountains leave you speechless. Nam at nibh non neque consequat molestie sed ut turpis. Phasellus gravida porttitor turpis ac fringilla. Nullam at scelerisque arcu.", Jukka));
		this.entries.save(new Entry("Australia", "2013-02-05", "Here you sure can get away from it all. Etiam ante leo, ornare vel enim id, ullamcorper vulputate metus. Aliquam erat volutpat. Maecenas semper arcu dictum nisi laoreet, ut scelerisque nisl consectetur.", Jukka));

		

		SecurityContextHolder.clearContext();
	}
}
